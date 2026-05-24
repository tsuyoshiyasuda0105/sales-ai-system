import { prisma } from "@/lib/db";

export const DEMO_ORGANIZATION_ID = "00000000-0000-4000-8000-000000000101";

export type OpportunityRow = {
  id: string;
  product: string;
  productImageUrl?: string | null;
  buyChannel: string;
  sellChannel: string;
  buyPrice: number;
  buyShipping: number;
  pointValue: number;
  expectedSellPrice: number | null;
  estimatedProfit: number | null;
  roi: number | null;
  judgement: "A" | "B" | "C" | "NG";
  risk: string;
  status: string;
  sourceUrl?: string | null;
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
          image_url: true
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
    const judgement = normalizeJudgement(String(opportunity.judgement), estimatedProfit, roi);
    const productTitle =
      opportunity.products_cross_channel_opportunities_product_idToproducts?.title ??
      opportunity.buy_channel_product_id ??
      opportunity.sell_channel_product_id ??
      "名称未設定の商品";

    return {
      id: opportunity.id,
      product: productTitle,
      productImageUrl: opportunity.products_cross_channel_opportunities_product_idToproducts?.image_url,
      buyChannel: channelLabel(String(opportunity.buy_channel)),
      sellChannel: channelLabel(String(opportunity.sell_channel)),
      buyPrice: decimalToNumber(opportunity.buy_price_amount),
      buyShipping: decimalToNumber(opportunity.buy_shipping_amount),
      pointValue: decimalToNumber(opportunity.buy_point_value_amount),
      expectedSellPrice: decimalToNumber(opportunity.expected_sell_price_amount),
      estimatedProfit,
      roi,
      judgement,
      risk:
        opportunity.risk_notes ??
        opportunity.reason_summary ??
        riskLabel({
          status: String(opportunity.status),
          expectedSellPrice: decimalToNumber(opportunity.expected_sell_price_amount),
          estimatedProfit,
          roi,
          expiresAt: opportunity.expires_at
        }),
      status: statusLabel(String(opportunity.status)),
      sourceUrl: opportunity.buy_url,
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
    const productTitle = candidate.products_sourcing_candidates_product_idToproducts?.title ?? candidate.source_title;

    return {
      id: candidate.id,
      product: productTitle,
      productImageUrl: candidate.products_sourcing_candidates_product_idToproducts?.image_url,
      buyChannel: channelLabel(String(candidate.source_channel)),
      sellChannel: channelLabel(String(candidate.target_channel)),
      buyPrice,
      buyShipping,
      pointValue,
      expectedSellPrice,
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
      createdAt: candidate.created_at.toISOString()
    };
  });

  return [...crossChannelRows, ...candidateRows]
    .sort((a, b) => {
      const profitA = a.estimatedProfit ?? Number.NEGATIVE_INFINITY;
      const profitB = b.estimatedProfit ?? Number.NEGATIVE_INFINITY;

      if (profitA !== profitB) return profitB - profitA;

      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    })
    .slice(0, 100);
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
