import { prisma } from "@/lib/db";
import { extractModelNumbers, isFurusatoNozei } from "@/lib/sales/jan";

export const DEMO_ORGANIZATION_ID = "00000000-0000-4000-8000-000000000101";

export type OpportunityRow = {
  id: string;
  product: string;
  productId: string | null;
  productImageUrl?: string | null;
  buyChannel: string;
  sellChannel: string;
  buyPrice: number;
  buyShipping: number;
  pointValue: number;
  expectedSellPrice: number | null;
  expectedSellPriceLower: number | null;
  expectedSellPriceUpper: number | null;
  breakEvenPrice: number | null;
  estimatedProfit: number | null;
  roi: number | null;
  judgement: "A" | "B" | "C" | "NG";
  risk: string;
  status: string;
  sourceUrl?: string | null;
  priceBasis: "real" | "estimate";
  sellListingCount: number | null;
  sellUrl?: string | null;
  variantCount?: number;
  reviewCount: number | null;
  reviewRating: number | null;
  createdAt: string;
};

export async function listOpportunityRows(organizationId: string): Promise<OpportunityRow[]> {
  const [crossChannelOpportunities, candidates] = await Promise.all([
    prisma.cross_channel_opportunities.findMany({
      where: {
        organization_id: organizationId,
        deleted_at: null,
        status: {
          in: ["new", "watching", "approved"]
        }
      },
      include: {
        products_cross_channel_opportunities_product_idToproducts: {
          select: {
            title: true,
            image_url: true
          }
        }
      },
      orderBy: [{ estimated_profit_amount: "desc" }, { created_at: "desc" }],
      take: 100
    }),
    prisma.sourcing_candidates.findMany({
    where: {
      organization_id: organizationId,
      deleted_at: null,
      status: {
        in: ["new", "watching", "approved"]
      }
    },
    include: {
      products_sourcing_candidates_product_idToproducts: {
        select: {
          title: true,
          image_url: true,
          market_prices: {
            orderBy: { fetched_at: "desc" },
            take: 6,
            // 🚀 raw_payload を select から除外: Yahoo の生レスポンス JSON
            //   (~1-2KB × 6件 × 100候補 = 数百KB) が page props に乗らないようにする。
            //   Yahoo の min/count はスカラ列 (price_amount / seller_count) で復元可能。
            //   max は失われるが expectedSellPriceUpper は ±10% フォールバックで足りる。
            select: {
              source_channel: true,
              price_amount: true,
              source_url: true,
              seller_count: true,
              review_count: true,
              review_rating: true
            }
          }
        }
      }
    },
    orderBy: [{ estimated_profit_amount: "desc" }, { created_at: "desc" }],
    take: 100
    })
  ]);

  const crossChannelRows = crossChannelOpportunities.map((opportunity) => {
    const estimatedProfit = decimalToNullableNumber(opportunity.estimated_profit_amount);
    const roi = decimalToNullableNumber(opportunity.estimated_roi);
    const expectedSellPrice = decimalToNumber(opportunity.expected_sell_price_amount);
    const sellPriceRange = sellPriceRangeFromExpected(expectedSellPrice);
    const breakEvenPrice = Math.max(
      0,
      decimalToNumber(opportunity.buy_price_amount) +
        decimalToNumber(opportunity.buy_shipping_amount) -
        decimalToNumber(opportunity.buy_point_value_amount) +
        decimalToNumber(opportunity.estimated_fee_amount) +
        decimalToNumber(opportunity.estimated_tax_amount) +
        decimalToNumber(opportunity.estimated_shipping_amount) +
        decimalToNumber(opportunity.estimated_packaging_amount)
    );
    const judgement = normalizeJudgement(String(opportunity.judgement), estimatedProfit, roi);
    const productTitle =
      opportunity.products_cross_channel_opportunities_product_idToproducts?.title ??
      opportunity.buy_channel_product_id ??
      opportunity.sell_channel_product_id ??
      "名称未設定の商品";

    return {
      id: opportunity.id,
      product: productTitle,
      productId: opportunity.product_id ?? null,
      productImageUrl: opportunity.products_cross_channel_opportunities_product_idToproducts?.image_url,
      buyChannel: channelLabel(String(opportunity.buy_channel)),
      sellChannel: channelLabel(String(opportunity.sell_channel)),
      buyPrice: decimalToNumber(opportunity.buy_price_amount),
      buyShipping: decimalToNumber(opportunity.buy_shipping_amount),
      pointValue: decimalToNumber(opportunity.buy_point_value_amount),
      expectedSellPrice,
      expectedSellPriceLower: sellPriceRange.lower,
      expectedSellPriceUpper: sellPriceRange.upper,
      breakEvenPrice,
      estimatedProfit,
      roi,
      judgement,
      risk:
        opportunity.risk_notes ??
        opportunity.reason_summary ??
        riskLabel({
          status: String(opportunity.status),
          expectedSellPrice,
          estimatedProfit,
          roi,
          expiresAt: opportunity.expires_at
        }),
      status: statusLabel(String(opportunity.status)),
      sourceUrl: opportunity.buy_url,
      priceBasis: "estimate",
      sellListingCount: null,
      sellUrl: null,
      reviewCount: null,
      reviewRating: null,
      createdAt: opportunity.created_at.toISOString()
    } satisfies OpportunityRow;
  });

  const candidateRows = candidates.map((candidate) => {
    const buyPrice = decimalToNumber(candidate.source_price_amount);
    const buyShipping = decimalToNumber(candidate.source_shipping_amount);
    const pointValue = decimalToNumber(candidate.source_point_value_amount);
    const estimatedProfit = decimalToNullableNumber(candidate.estimated_profit_amount);
    const roi = decimalToNullableNumber(candidate.estimated_roi);
    const expectedSellPrice = decimalToNullableNumber(candidate.target_expected_price_amount);
    const sellPriceRange = sellPriceRangeFromExpected(expectedSellPrice);
    const breakEvenPrice = decimalToNullableNumber(candidate.break_even_price_amount);
    const product = candidate.products_sourcing_candidates_product_idToproducts;
    const productTitle = product?.title ?? candidate.source_title;
    const allMarketPrices = product?.market_prices ?? [];
    const yahooMarketPrice = allMarketPrices.find((price) => String(price.source_channel) === "yahoo_shopping");
    const rakutenMarketPrice = allMarketPrices.find((price) => String(price.source_channel) === "rakuten");
    // price_amount は persistYahooMarketPrice 側で stats.min を入れている (実質 Yahoo市場最安)。
    // seller_count は同様に stats.count を保存している。raw_payload に頼らず復元できる。
    const yahooMin = yahooMarketPrice ? decimalToNumber(yahooMarketPrice.price_amount) : null;
    const yahooListingCount = yahooMarketPrice?.seller_count ?? null;
    const isRealPrice = String(candidate.target_channel) === "yahoo_shopping" && Boolean(yahooMarketPrice);
    const reviewCount = rakutenMarketPrice?.review_count ?? null;
    const reviewRating =
      rakutenMarketPrice?.review_rating != null ? Number(rakutenMarketPrice.review_rating) : null;

    return {
      id: candidate.id,
      product: productTitle,
      productId: candidate.product_id ?? null,
      productImageUrl: product?.image_url,
      buyChannel: channelLabel(String(candidate.source_channel)),
      sellChannel: channelLabel(String(candidate.target_channel)),
      buyPrice,
      buyShipping,
      pointValue,
      expectedSellPrice,
      expectedSellPriceLower: isRealPrice ? yahooMin ?? sellPriceRange.lower : sellPriceRange.lower,
      // Yahoo max は raw_payload からの参照を除いたので ±10% フォールバックを使う。
      // ユーザー表示上、上限は文脈ヒントでしかなく実害は無い。
      expectedSellPriceUpper: sellPriceRange.upper,
      breakEvenPrice,
      estimatedProfit,
      roi,
      judgement: judgementFromMetrics(estimatedProfit, roi),
      risk: riskLabel({
        status: String(candidate.status),
        expectedSellPrice,
        estimatedProfit,
        roi,
        expiresAt: candidate.expires_at
      }),
      status: statusLabel(String(candidate.status)),
      sourceUrl: candidate.source_url,
      priceBasis: isRealPrice ? "real" : "estimate",
      sellListingCount: isRealPrice ? yahooListingCount : null,
      sellUrl: isRealPrice ? yahooMarketPrice?.source_url ?? candidate.target_url : null,
      reviewCount,
      reviewRating,
      createdAt: candidate.created_at.toISOString()
    } satisfies OpportunityRow;
  });

  const merged = [...crossChannelRows, ...candidateRows].filter((row) => !isFurusatoNozei(row.product));

  return dedupeByModelNumber(merged)
    .sort((a, b) => {
      const profitA = a.estimatedProfit ?? Number.NEGATIVE_INFINITY;
      const profitB = b.estimatedProfit ?? Number.NEGATIVE_INFINITY;

      if (profitA !== profitB) return profitB - profitA;

      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    })
    .slice(0, 100);
}

/**
 * Collapse rows that share the same model number into a single row (the highest-profit one),
 * recording how many variants were folded in via variantCount. Rows without a detectable
 * model number are passed through unchanged.
 */
function dedupeByModelNumber(rows: OpportunityRow[]): OpportunityRow[] {
  const groups = new Map<string, OpportunityRow[]>();
  const ungrouped: OpportunityRow[] = [];

  for (const row of rows) {
    const models = extractModelNumbers(row.product);

    if (models.length === 0) {
      ungrouped.push(row);
      continue;
    }

    const key = models[0];
    const existing = groups.get(key);
    if (existing) {
      existing.push(row);
    } else {
      groups.set(key, [row]);
    }
  }

  const result: OpportunityRow[] = [...ungrouped];

  for (const group of groups.values()) {
    if (group.length === 1) {
      result.push(group[0]);
      continue;
    }

    // Prefer real-price rows over estimates: an estimate-based profit can be artificially higher
    // (markup ×1.35 over a low Rakuten price), and would otherwise hide the real ground truth.
    // Within the same priceBasis class, fall back to the highest estimated profit.
    const winner = [...group].sort((a, b) => {
      const aReal = a.priceBasis === "real" ? 1 : 0;
      const bReal = b.priceBasis === "real" ? 1 : 0;
      if (aReal !== bReal) return bReal - aReal;

      const ap = a.estimatedProfit ?? Number.NEGATIVE_INFINITY;
      const bp = b.estimatedProfit ?? Number.NEGATIVE_INFINITY;
      return bp - ap;
    })[0];

    result.push({ ...winner, variantCount: group.length });
  }

  return result;
}

function decimalToNumber(value: { toNumber?: () => number } | number | null | undefined) {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value.toNumber === "function") return value.toNumber();

  return Number(value);
}

function decimalToNullableNumber(value: { toNumber?: () => number } | number | null | undefined) {
  if (value == null) return null;

  return decimalToNumber(value);
}

function sellPriceRangeFromExpected(expectedSellPrice: number | null) {
  if (expectedSellPrice == null) {
    return {
      lower: null,
      upper: null
    };
  }

  return {
    lower: Math.round(expectedSellPrice * 0.9),
    upper: Math.round(expectedSellPrice * 1.1)
  };
}

function judgementFromMetrics(estimatedProfit: number | null, roi: number | null): OpportunityRow["judgement"] {
  if (estimatedProfit == null || roi == null) return "C";
  if (estimatedProfit <= 0 || roi <= 0) return "NG";
  if (estimatedProfit >= 2000 && roi >= 0.2) return "A";
  if (estimatedProfit >= 800 && roi >= 0.1) return "B";

  return "C";
}

function normalizeJudgement(
  value: string,
  estimatedProfit: number | null,
  roi: number | null
): OpportunityRow["judgement"] {
  const upper = value.toUpperCase();

  if (upper === "A" || upper === "B" || upper === "C" || upper === "NG") {
    return upper;
  }

  return judgementFromMetrics(estimatedProfit, roi);
}

function riskLabel({
  status,
  expectedSellPrice,
  estimatedProfit,
  roi,
  expiresAt
}: {
  status: string;
  expectedSellPrice: number | null;
  estimatedProfit: number | null;
  roi: number | null;
  expiresAt: Date | null;
}) {
  if (status === "approved") return "承認済みの仕入れ候補です。";
  if (expiresAt && expiresAt.getTime() < Date.now()) return "期限切れのため再確認が必要です。";
  if (expectedSellPrice == null) return "販売想定価格が未入力です。";
  if (estimatedProfit == null || roi == null) return "利益計算が未完了です。";
  if (estimatedProfit <= 0) return "利益が出ない可能性があります。";
  if (roi < 0.1) return "ROIが低いため販売条件の確認が必要です。";

  return "仕入れ前に在庫・送料・販売手数料を確認してください。";
}

function channelLabel(channel: string) {
  const labels: Record<string, string> = {
    amazon_jp: "Amazon JP",
    rakuten: "楽天",
    yahoo_shopping: "Yahoo!ショッピング",
    yahoo_auction: "Yahoo!オークション",
    mercari: "メルカリ",
    store: "店舗/自社"
  };

  return labels[channel] ?? channel;
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    new: "新規",
    watching: "監視中",
    approved: "承認済み",
    rejected: "見送り",
    expired: "期限切れ",
    purchased: "仕入れ済み"
  };

  return labels[status] ?? status;
}
