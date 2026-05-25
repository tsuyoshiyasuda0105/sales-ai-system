export type TargetSalesChannel = "amazon_jp" | "mercari" | "yahoo_auction" | "yahoo_shopping" | "store";

export type ProfitEstimateInput = {
  sourcePrice: number;
  sourceShipping?: number;
  sourcePointValue?: number;
  targetChannel?: TargetSalesChannel;
  /** Real observed sell price (e.g. Yahoo lowest listing). When set, replaces the markup guess. */
  expectedSellPriceOverride?: number;
};

export type ProfitEstimate = {
  targetChannel: TargetSalesChannel;
  priceBasis: "real" | "estimate";
  expectedSellPrice: number;
  platformFee: number;
  fbaFee: number;
  shipping: number;
  packaging: number;
  profit: number;
  roi: number;
  profitMargin: number;
  breakEvenPrice: number;
  recommendedMaxPurchaseQuantity: number;
  judgement: "a" | "b" | "c" | "ng";
  totalScore: number;
  reasonSummary: string;
  riskNotes: string;
};

type ChannelAssumption = {
  markupRate: number;
  platformFeeRate: number;
  fbaFee: number;
  shipping: number;
  packaging: number;
};

const CHANNEL_ASSUMPTIONS: Record<TargetSalesChannel, ChannelAssumption> = {
  amazon_jp: {
    markupRate: 1.35,
    platformFeeRate: 0.1,
    fbaFee: 520,
    shipping: 0,
    packaging: 80
  },
  mercari: {
    markupRate: 1.28,
    platformFeeRate: 0.1,
    fbaFee: 0,
    shipping: 750,
    packaging: 80
  },
  yahoo_auction: {
    markupRate: 1.25,
    platformFeeRate: 0.088,
    fbaFee: 0,
    shipping: 750,
    packaging: 80
  },
  yahoo_shopping: {
    markupRate: 1.3,
    platformFeeRate: 0.08,
    fbaFee: 0,
    shipping: 650,
    packaging: 80
  },
  store: {
    markupRate: 1.22,
    platformFeeRate: 0.035,
    fbaFee: 0,
    shipping: 0,
    packaging: 60
  }
};

export function estimateSourcingProfit(input: ProfitEstimateInput): ProfitEstimate {
  const targetChannel = input.targetChannel ?? "amazon_jp";
  const assumption = CHANNEL_ASSUMPTIONS[targetChannel];
  const sourcePrice = Math.max(0, roundMoney(input.sourcePrice));
  const sourceShipping = Math.max(0, roundMoney(input.sourceShipping ?? 0));
  const sourcePointValue = Math.max(0, roundMoney(input.sourcePointValue ?? 0));
  const netCost = Math.max(1, sourcePrice + sourceShipping - sourcePointValue);
  const override = input.expectedSellPriceOverride;
  const hasRealPrice = override != null && Number.isFinite(override) && override > 0;
  const expectedSellPrice = hasRealPrice ? roundMoney(override) : roundMoney(netCost * assumption.markupRate);
  const platformFee = roundMoney(expectedSellPrice * assumption.platformFeeRate);
  const fbaFee = roundMoney(assumption.fbaFee);
  const shipping = roundMoney(assumption.shipping);
  const packaging = roundMoney(assumption.packaging);
  const profit = roundMoney(expectedSellPrice - netCost - platformFee - fbaFee - shipping - packaging);
  const roi = roundRatio(profit / netCost);
  const profitMargin = roundRatio(profit / Math.max(1, expectedSellPrice));
  const breakEvenPrice = roundMoney(netCost + platformFee + fbaFee + shipping + packaging);
  const judgement = judgementFromProfit(profit, roi);
  const totalScore = scoreFromProfit(profit, roi, profitMargin);

  return {
    targetChannel,
    priceBasis: hasRealPrice ? "real" : "estimate",
    expectedSellPrice,
    platformFee,
    fbaFee,
    shipping,
    packaging,
    profit,
    roi,
    profitMargin,
    breakEvenPrice,
    recommendedMaxPurchaseQuantity: recommendedQuantity(judgement, roi),
    judgement,
    totalScore,
    reasonSummary: buildReasonSummary({ profit, roi, targetChannel, hasRealPrice }),
    riskNotes: buildRiskNotes({ sourcePointValue, profit, roi })
  };
}

function judgementFromProfit(profit: number, roi: number): ProfitEstimate["judgement"] {
  if (profit <= 0 || roi <= 0) return "ng";
  if (profit >= 2000 && roi >= 0.2) return "a";
  if (profit >= 800 && roi >= 0.1) return "b";

  return "c";
}

function scoreFromProfit(profit: number, roi: number, profitMargin: number) {
  const profitScore = clamp((profit / 3000) * 45, 0, 45);
  const roiScore = clamp((roi / 0.35) * 35, 0, 35);
  const marginScore = clamp((profitMargin / 0.25) * 20, 0, 20);

  return Math.round(profitScore + roiScore + marginScore);
}

function recommendedQuantity(judgement: ProfitEstimate["judgement"], roi: number) {
  if (judgement === "a" && roi >= 0.3) return 3;
  if (judgement === "a" || judgement === "b") return 1;

  return 0;
}

function buildReasonSummary({
  profit,
  roi,
  targetChannel,
  hasRealPrice
}: {
  profit: number;
  roi: number;
  targetChannel: TargetSalesChannel;
  hasRealPrice: boolean;
}) {
  const basis = hasRealPrice
    ? `${channelLabel(targetChannel)}の実売価格(出品最安値)をもとに`
    : `楽天仕入れ価格をもとに${channelLabel(targetChannel)}販売を仮定して`;

  return `${basis}自動計算しました。想定利益は${formatYen(profit)}、ROIは${(roi * 100).toFixed(1)}%です。`;
}

function buildRiskNotes({
  sourcePointValue,
  profit,
  roi
}: {
  sourcePointValue: number;
  profit: number;
  roi: number;
}) {
  if (profit <= 0) return "利益が出ない試算です。販売価格または手数料条件を見直してください。";
  if (roi < 0.1) return "ROIが低めです。送料、販売手数料、回転率の確認が必要です。";
  if (sourcePointValue > 0) return "ポイント還元を含む試算です。実際に獲得できるポイント条件を確認してください。";

  return "仮販売価格による初期試算です。実相場で再確認してください。";
}

function channelLabel(channel: TargetSalesChannel) {
  const labels: Record<TargetSalesChannel, string> = {
    amazon_jp: "Amazon JP",
    mercari: "メルカリ",
    yahoo_auction: "Yahoo!オークション",
    yahoo_shopping: "Yahoo!ショッピング",
    store: "店舗/自社"
  };

  return labels[channel];
}

function roundMoney(value: number) {
  return Math.round(value);
}

function roundRatio(value: number) {
  return Math.round(value * 10000) / 10000;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatYen(amount: number) {
  return `${amount.toLocaleString("ja-JP")}円`;
}
