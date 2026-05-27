import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/db";
import { estimateSourcingProfit } from "@/lib/sales/profit";

type RouteParams = {
  params: Promise<{ organizationId: string }>;
};

const FURUSATO_URL_PATTERN =
  /store\.shopping\.yahoo\.co\.jp\/(y-)?furusato|furusato\.|y-furusato|furunavi|furutax/i;
const FURUSATO_KEYWORD_PATTERN = /ふるさと納税|寄付金額|寄附金額|返礼品|お礼の品|自治体|納税返礼/;
const MUNICIPALITY_SELLER_PATTERN = /(都|道|府|県).*(市|町|村|区)|^(?:.{1,8})(市|町|村)$/;

type StoredYahooPrice = {
  id: string;
  product_id: string | null;
  source_url: string | null;
  seller_name: string | null;
  raw_payload: unknown;
};

function isStoredYahooFurusato(price: StoredYahooPrice): boolean {
  if (price.source_url && FURUSATO_URL_PATTERN.test(price.source_url)) return true;
  if (price.seller_name) {
    if (FURUSATO_KEYWORD_PATTERN.test(price.seller_name)) return true;
    if (MUNICIPALITY_SELLER_PATTERN.test(price.seller_name)) return true;
  }
  if (price.raw_payload && typeof price.raw_payload === "object") {
    const payload = price.raw_payload as {
      top?: Array<{ name?: string; url?: string; store?: string }>;
    };
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

export async function POST(request: Request, { params }: RouteParams) {
  const { organizationId } = await params;
  const body = (await request.json().catch(() => ({}))) as { dryRun?: unknown } | null;
  const dryRun = body?.dryRun === true;

  // 1. Find all yahoo_shopping market_prices and identify the ふるさと納税-tainted ones in JS.
  const allYahoo = await prisma.market_prices.findMany({
    where: { organization_id: organizationId, source_channel: "yahoo_shopping" },
    select: { id: true, product_id: true, source_url: true, seller_name: true, raw_payload: true }
  });

  const taintedPrices = allYahoo.filter(isStoredYahooFurusato);
  const taintedPriceIds = taintedPrices.map((price) => price.id);
  const taintedProductIds = Array.from(
    new Set(taintedPrices.map((price) => price.product_id).filter((id): id is string => Boolean(id)))
  );

  // 2. Find candidates that were promoted to yahoo_shopping based on the tainted data.
  const affectedCandidates =
    taintedProductIds.length === 0
      ? []
      : await prisma.sourcing_candidates.findMany({
          where: {
            organization_id: organizationId,
            product_id: { in: taintedProductIds },
            target_channel: "yahoo_shopping",
            deleted_at: null
          }
        });

  // 3. Reset each affected candidate back to amazon_jp + ×1.35 estimate.
  let resetCount = 0;
  if (!dryRun) {
    for (const candidate of affectedCandidates) {
      const sourcePrice = decimalToNumber(candidate.source_price_amount);
      const sourceShipping = decimalToNumber(candidate.source_shipping_amount);
      const sourcePointValue = decimalToNumber(candidate.source_point_value_amount);
      const estimate = estimateSourcingProfit({
        sourcePrice,
        sourceShipping,
        sourcePointValue,
        targetChannel: "amazon_jp"
      });

      await prisma.sourcing_candidates.update({
        where: { id: candidate.id },
        data: {
          target_channel: "amazon_jp",
          target_url: null,
          target_expected_price_amount: estimate.expectedSellPrice,
          estimated_platform_fee_amount: estimate.platformFee,
          estimated_fba_fee_amount: estimate.fbaFee,
          estimated_shipping_amount: estimate.shipping,
          estimated_packaging_amount: estimate.packaging,
          estimated_profit_amount: estimate.profit,
          estimated_roi: estimate.roi,
          estimated_profit_margin: estimate.profitMargin,
          break_even_price_amount: estimate.breakEvenPrice,
          recommended_max_purchase_quantity: estimate.recommendedMaxPurchaseQuantity,
          updated_at: new Date()
        }
      });
      resetCount += 1;
    }
  }

  // 4. Remove the tainted market_prices outright so they can't reappear via the cross-platform
  //    join. The new yahoo-shopping client filter prevents future tainted rows from being saved.
  let deletedCount = 0;
  if (!dryRun && taintedPriceIds.length > 0) {
    const deleteResult = await prisma.market_prices.deleteMany({ where: { id: { in: taintedPriceIds } } });
    deletedCount = deleteResult.count;
  }

  const sampleTainted = taintedPrices.slice(0, 5).map((price) => ({
    id: price.id,
    productId: price.product_id,
    sourceUrl: price.source_url,
    sellerName: price.seller_name
  }));

  return ok({
    organizationId,
    dryRun,
    taintedMarketPricesFound: taintedPrices.length,
    taintedProductsAffected: taintedProductIds.length,
    candidatesResetToEstimate: resetCount,
    marketPricesDeleted: deletedCount,
    sampleTainted
  });
}

function decimalToNumber(value: { toNumber?: () => number } | number | null | undefined) {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value.toNumber === "function") return value.toNumber();
  return Number(value);
}
