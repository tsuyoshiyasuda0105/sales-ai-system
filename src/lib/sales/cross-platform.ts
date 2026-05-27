import { prisma } from "@/lib/db";
import { estimateSourcingProfit } from "@/lib/sales/profit";

export type ComparisonRole = "buy" | "sell";

export type ComparisonRow = {
  channel: string;
  role: ComparisonRole;
  price: number;
  shipping: number;
  pointValue: number;
  effectiveCost: number;
  inStock: boolean | null;
  sellerName: string | null;
  sourceUrl: string | null;
  fetchedAt: string;
  listingCount: number | null;
};

export type AmazonEstimate = {
  expectedSellPrice: number;
  estimatedProfit: number;
  breakEvenPrice: number;
  roi: number;
  judgement: "A" | "B" | "C" | "NG";
};

export type ProductComparison = {
  productId: string;
  title: string;
  imageUrl: string | null;
  rows: ComparisonRow[];
  cheapestBuy: number | null;
  bestSell: number | null;
  estimatedSpread: number | null;
  amazonEstimate: AmazonEstimate | null;
};

export type ComparableProduct = {
  productId: string;
  title: string;
};

const CHANNEL_LABELS: Record<string, string> = {
  amazon_jp: "Amazon JP",
  rakuten: "楽天",
  yahoo_shopping: "Yahoo!ショッピング",
  yahoo_auction: "Yahoo!オークション",
  mercari: "メルカリ",
  ebay: "eBay",
  store: "店舗/自社",
  other: "その他"
};

const BUY_CHANNELS = new Set(["rakuten", "store"]);

function roleOf(channel: string): ComparisonRole {
  return BUY_CHANNELS.has(channel) ? "buy" : "sell";
}

export async function listComparableProducts(organizationId: string, limit = 40): Promise<ComparableProduct[]> {
  const prices = await prisma.market_prices.findMany({
    where: {
      organization_id: organizationId,
      source_channel: "yahoo_shopping",
      product_id: { not: null }
    },
    select: {
      product_id: true,
      fetched_at: true,
      products: { select: { title: true } }
    },
    orderBy: { fetched_at: "desc" },
    take: 300
  });

  const seen = new Set<string>();
  const result: ComparableProduct[] = [];

  for (const price of prices) {
    if (!price.product_id || seen.has(price.product_id)) continue;
    seen.add(price.product_id);
    result.push({ productId: price.product_id, title: price.products?.title ?? "(無題の商品)" });
    if (result.length >= limit) break;
  }

  return result;
}

export async function getProductComparison(
  organizationId: string,
  selector: { productId?: string; title?: string }
): Promise<ProductComparison | null> {
  if (!selector.productId && !selector.title) return null;

  const where = selector.productId ? { id: selector.productId } : { title: { contains: selector.title } };

  const product = await prisma.products.findFirst({
    where: {
      organization_id: organizationId,
      deleted_at: null,
      ...where
    },
    include: {
      market_prices: { orderBy: { fetched_at: "desc" }, take: 50 }
    },
    orderBy: { created_at: "desc" }
  });

  if (!product) return null;

  const seenChannels = new Set<string>();
  const rows: ComparisonRow[] = [];

  for (const marketPrice of product.market_prices) {
    const channel = String(marketPrice.source_channel);
    if (seenChannels.has(channel)) continue;

    // Skip Yahoo!ふるさと納税 rows that were saved before the Yahoo client filter shipped.
    // Their "price" is a donation amount, not a sell-side market floor.
    if (channel === "yahoo_shopping" && isStoredYahooFurusato(marketPrice)) {
      continue;
    }

    seenChannels.add(channel);

    const role = roleOf(channel);
    const price = decimalToNumber(marketPrice.price_amount);
    const shipping = decimalToNumber(marketPrice.shipping_amount);
    const pointValue = decimalToNumber(marketPrice.point_value_amount);

    rows.push({
      channel: CHANNEL_LABELS[channel] ?? channel,
      role,
      price,
      shipping,
      pointValue,
      effectiveCost: role === "buy" ? Math.max(0, price + shipping - pointValue) : price,
      inStock: marketPrice.is_in_stock,
      sellerName: marketPrice.seller_name,
      sourceUrl: marketPrice.source_url,
      fetchedAt: marketPrice.fetched_at.toISOString(),
      listingCount: listingCountFromPayload(marketPrice.raw_payload)
    });
  }

  rows.sort((a, b) => (a.role === b.role ? a.effectiveCost - b.effectiveCost : a.role === "buy" ? -1 : 1));

  const buyRows = rows.filter((row) => row.role === "buy");
  const sellRows = rows.filter((row) => row.role === "sell");
  const cheapestBuy = buyRows.length > 0 ? Math.min(...buyRows.map((row) => row.effectiveCost)) : null;
  const bestSell = sellRows.length > 0 ? Math.min(...sellRows.map((row) => row.price)) : null;

  let amazonEstimate: AmazonEstimate | null = null;

  if (cheapestBuy != null) {
    const cheapestBuyRow = buyRows.find((row) => row.effectiveCost === cheapestBuy);

    if (cheapestBuyRow) {
      const estimate = estimateSourcingProfit({
        sourcePrice: cheapestBuyRow.price,
        sourceShipping: cheapestBuyRow.shipping,
        sourcePointValue: cheapestBuyRow.pointValue,
        targetChannel: "amazon_jp"
      });

      amazonEstimate = {
        expectedSellPrice: estimate.expectedSellPrice,
        estimatedProfit: estimate.profit,
        breakEvenPrice: estimate.breakEvenPrice,
        roi: estimate.roi,
        judgement: estimate.judgement.toUpperCase() as "A" | "B" | "C" | "NG"
      };
    }
  }

  return {
    productId: product.id,
    title: product.title,
    imageUrl: product.image_url,
    rows,
    cheapestBuy,
    bestSell,
    estimatedSpread: cheapestBuy != null && bestSell != null ? bestSell - cheapestBuy : null,
    amazonEstimate
  };
}

const FURUSATO_URL_PATTERN =
  /store\.shopping\.yahoo\.co\.jp\/(y-)?furusato|furusato\.|y-furusato|furunavi|furutax/i;
const FURUSATO_KEYWORD_PATTERN = /ふるさと納税|寄付金額|寄附金額|返礼品|お礼の品|自治体|納税返礼/;
const MUNICIPALITY_SELLER_PATTERN = /(都|道|府|県).*(市|町|村|区)|^(?:.{1,8})(市|町|村)$/;

function isStoredYahooFurusato(price: {
  source_url: string | null;
  seller_name: string | null;
  raw_payload: unknown;
}): boolean {
  if (price.source_url && FURUSATO_URL_PATTERN.test(price.source_url)) return true;
  if (price.seller_name) {
    if (FURUSATO_KEYWORD_PATTERN.test(price.seller_name)) return true;
    if (MUNICIPALITY_SELLER_PATTERN.test(price.seller_name)) return true;
  }

  if (price.raw_payload && typeof price.raw_payload === "object") {
    const payload = price.raw_payload as { top?: Array<{ name?: string; url?: string; store?: string }> };
    const top = payload.top?.[0];
    if (top) {
      if (top.url && FURUSATO_URL_PATTERN.test(top.url)) return true;
      if (top.name && FURUSATO_KEYWORD_PATTERN.test(top.name)) return true;
      if (top.store) {
        if (FURUSATO_KEYWORD_PATTERN.test(top.store)) return true;
        if (MUNICIPALITY_SELLER_PATTERN.test(top.store)) return true;
      }
    }
  }

  return false;
}

function listingCountFromPayload(payload: unknown): number | null {
  if (payload && typeof payload === "object" && "count" in payload) {
    const count = (payload as { count?: unknown }).count;
    return typeof count === "number" ? count : null;
  }

  return null;
}

function decimalToNumber(value: { toNumber?: () => number } | number | null | undefined) {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value.toNumber === "function") return value.toNumber();

  return Number(value);
}
