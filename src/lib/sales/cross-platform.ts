import { prisma } from "@/lib/db";

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

export type ProductComparison = {
  productId: string;
  title: string;
  imageUrl: string | null;
  rows: ComparisonRow[];
  cheapestBuy: number | null;
  bestSell: number | null;
  estimatedSpread: number | null;
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

  return {
    productId: product.id,
    title: product.title,
    imageUrl: product.image_url,
    rows,
    cheapestBuy,
    bestSell,
    estimatedSpread: cheapestBuy != null && bestSell != null ? bestSell - cheapestBuy : null
  };
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
