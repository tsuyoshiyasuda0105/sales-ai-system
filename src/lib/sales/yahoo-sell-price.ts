import { prisma } from "@/lib/db";
import { searchYahooItems, YahooApiError, type NormalizedYahooItem } from "@/lib/integrations/yahoo-shopping";
import { estimateSourcingProfit } from "@/lib/sales/profit";
import { extractJanFromTitle } from "@/lib/sales/jan";

export type YahooMatchConfidence = "high" | "medium" | "low";
export type YahooMatchType = "jan" | "keyword" | "none";

export type YahooSellPriceStats = {
  matched: boolean;
  matchType: YahooMatchType;
  confidence: YahooMatchConfidence;
  count: number;
  min: number | null;
  median: number | null;
  max: number | null;
  query: string;
  top: Array<{ name: string; price: number; url: string; store?: string }>;
};

export type YahooRefreshSummary = {
  processed: number;
  matched: number;
  updated: number;
  highConfidence: number;
  mediumConfidence: number;
  lowConfidence: number;
  noMatch: number;
  rateLimited: boolean;
  errors: Array<{ candidateId: string; message: string }>;
};

const KEYWORD_DROP_THRESHOLD = 0.3;
const MEDIUM_SIMILARITY_THRESHOLD = 0.45;

export async function refreshYahooSellPrices(
  organizationId: string,
  options: { limit?: number } = {}
): Promise<YahooRefreshSummary> {
  const limit = clampInt(options.limit ?? 8, 1, 100);

  const candidates = await prisma.sourcing_candidates.findMany({
    where: {
      organization_id: organizationId,
      deleted_at: null,
      status: { in: ["new", "watching", "approved"] },
      NOT: [
        { source_title: { contains: "ふるさと納税" } },
        { target_channel: "yahoo_shopping" }
      ]
    },
    orderBy: { updated_at: "asc" },
    take: limit,
    include: {
      products_sourcing_candidates_product_idToproducts: {
        select: {
          title: true,
          product_identifiers_product_identifiers_product_idToproducts: {
            where: { identifier_type: "jan", deleted_at: null },
            select: { identifier_value: true },
            take: 1
          }
        }
      }
    }
  });

  const summary: YahooRefreshSummary = {
    processed: 0,
    matched: 0,
    updated: 0,
    highConfidence: 0,
    mediumConfidence: 0,
    lowConfidence: 0,
    noMatch: 0,
    rateLimited: false,
    errors: []
  };

  for (const candidate of candidates) {
    summary.processed += 1;
    const product = candidate.products_sourcing_candidates_product_idToproducts;
    const title = product?.title ?? candidate.source_title;
    const storedJan = product?.product_identifiers_product_identifiers_product_idToproducts?.[0]?.identifier_value;
    const jan = storedJan ?? extractJanFromTitle(title) ?? undefined;

    try {
      const stats = await fetchYahooSellPrice(title, jan);

      if (stats.confidence === "high") summary.highConfidence += 1;
      else if (stats.confidence === "medium") summary.mediumConfidence += 1;
      else summary.lowConfidence += 1;

      if (!stats.matched || stats.min == null) {
        summary.noMatch += 1;
        await touchCandidate(candidate.id);
        continue;
      }

      summary.matched += 1;

      if (candidate.product_id) {
        await persistYahooMarketPrice(organizationId, candidate.product_id, stats);
      }

      if (stats.confidence === "high" || stats.confidence === "medium") {
        await recomputeCandidateWithRealPrice(candidate, stats.min, stats);
        summary.updated += 1;
      } else {
        await touchCandidate(candidate.id);
      }
    } catch (error) {
      summary.errors.push({
        candidateId: candidate.id,
        message: error instanceof Error ? error.message : "Unknown error"
      });

      if (error instanceof YahooApiError && error.code === "rate_limited") {
        summary.rateLimited = true;
        break;
      }
    }

    await sleep(YAHOO_REQUEST_DELAY_MS);
  }

  return summary;
}

const YAHOO_REQUEST_DELAY_MS = 350;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchYahooSellPrice(title: string, jan?: string): Promise<YahooSellPriceStats> {
  const models = extractModelNumbers(title);

  if (jan) {
    const byJan = await searchYahooItems({ janCode: jan, conditionNew: true, inStockOnly: true, hits: 30 });
    const prices = pricesFromItems(byJan.items);

    if (prices.length > 0) {
      return buildStats(byJan.items, prices, "jan", "high", `jan:${jan}`);
    }
  }

  const query = buildKeywordQuery(title);

  if (!query) {
    return emptyStats(`keyword:${title}`);
  }

  const byKeyword = await searchYahooItems({ query, conditionNew: true, inStockOnly: true, hits: 30 });
  const relevant = byKeyword.items.filter((item) => {
    if (isLikelyAccessory(title, item.name)) return false;

    return modelMatches(models, item.name) || titleSimilarity(title, item.name) >= KEYWORD_DROP_THRESHOLD;
  });

  if (relevant.length === 0) {
    return emptyStats(`keyword:${query}`);
  }

  const prices = pricesFromItems(relevant);
  const hasModelHit = models.length > 0 && relevant.some((item) => modelMatches(models, item.name));
  const bestSimilarity = Math.max(...relevant.map((item) => titleSimilarity(title, item.name)));
  const confidence: YahooMatchConfidence = hasModelHit
    ? "high"
    : relevant.length >= 2 && bestSimilarity >= MEDIUM_SIMILARITY_THRESHOLD
      ? "medium"
      : "low";

  return buildStats(relevant, prices, "keyword", confidence, `keyword:${query}`);
}

function pricesFromItems(items: NormalizedYahooItem[]) {
  return items
    .map((item) => item.price)
    .filter((price) => Number.isFinite(price) && price > 0)
    .sort((a, b) => a - b);
}

function buildStats(
  items: NormalizedYahooItem[],
  sortedPrices: number[],
  matchType: YahooMatchType,
  confidence: YahooMatchConfidence,
  query: string
): YahooSellPriceStats {
  const sortedItems = [...items].sort((a, b) => a.price - b.price);

  return {
    matched: true,
    matchType,
    confidence,
    count: sortedPrices.length,
    min: sortedPrices[0] ?? null,
    median: medianOf(sortedPrices),
    max: sortedPrices[sortedPrices.length - 1] ?? null,
    query,
    top: sortedItems.slice(0, 3).map((item) => ({
      name: item.name,
      price: item.price,
      url: item.url,
      store: item.storeName
    }))
  };
}

function emptyStats(query: string): YahooSellPriceStats {
  return {
    matched: false,
    matchType: "none",
    confidence: "low",
    count: 0,
    min: null,
    median: null,
    max: null,
    query,
    top: []
  };
}

async function persistYahooMarketPrice(organizationId: string, productId: string, stats: YahooSellPriceStats) {
  const top = stats.top[0];

  await prisma.market_prices.create({
    data: {
      organization_id: organizationId,
      product_id: productId,
      source_channel: "yahoo_shopping",
      source_product_id: top?.url ?? null,
      source_url: top?.url ?? null,
      condition: "new",
      price_amount: stats.min ?? 0,
      currency_code: "JPY",
      is_in_stock: true,
      seller_name: top?.store,
      seller_count: stats.count,
      raw_payload: {
        basis: stats.confidence === "high" || stats.confidence === "medium" ? "real" : "low",
        matchType: stats.matchType,
        confidence: stats.confidence,
        count: stats.count,
        min: stats.min,
        median: stats.median,
        max: stats.max,
        query: stats.query,
        sampledAt: new Date().toISOString(),
        top: stats.top
      }
    }
  });
}

type CandidateForRecompute = {
  id: string;
  source_price_amount: { toNumber?: () => number } | number;
  source_shipping_amount: { toNumber?: () => number } | number;
  source_point_value_amount: { toNumber?: () => number } | number;
};

async function recomputeCandidateWithRealPrice(
  candidate: CandidateForRecompute,
  realSellPrice: number,
  stats: YahooSellPriceStats
) {
  const estimate = estimateSourcingProfit({
    sourcePrice: decToNum(candidate.source_price_amount),
    sourceShipping: decToNum(candidate.source_shipping_amount),
    sourcePointValue: decToNum(candidate.source_point_value_amount),
    targetChannel: "yahoo_shopping",
    expectedSellPriceOverride: realSellPrice
  });

  await prisma.sourcing_candidates.update({
    where: { id: candidate.id },
    data: {
      target_channel: "yahoo_shopping",
      target_url: stats.top[0]?.url,
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
}

async function touchCandidate(id: string) {
  await prisma.sourcing_candidates.update({
    where: { id },
    data: { updated_at: new Date() }
  });
}

const NOISE_WORDS =
  /ふるさと納税|送料無料|送料込み?|新品|未使用品?|中古|限定|クーポン|ポイント|還元|レビュー|あす楽|正規品|日本語|国内専用|国内版|専用|公式|まとめ買い|お買い得|期間限定|割引|セール|高評価|人気|ランキング|おすすめ|新生活/g;

export function buildKeywordQuery(title: string) {
  const cleaned = stripNoise(title);
  const tokens = cleaned.split(" ").filter(Boolean);
  const modelTokens = tokens.filter(looksLikeModel);
  const words = tokens.filter((token) => !looksLikeModel(token));
  const picked = [...modelTokens.slice(0, 2), ...words.slice(0, modelTokens.length > 0 ? 3 : 5)];

  return Array.from(new Set(picked)).join(" ").slice(0, 50);
}

function stripNoise(title: string) {
  return title
    .replace(/【[^】]*】/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/[（(][^)）]*[)）]/g, " ")
    .replace(NOISE_WORDS, " ")
    .replace(/[!！?？|｜/／·・,，、。.　]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeModel(token: string) {
  return /[A-Za-z]/.test(token) && /[0-9]/.test(token) && token.replace(/[^A-Za-z0-9]/g, "").length >= 4;
}

function extractModelNumbers(title: string) {
  return Array.from(new Set(stripNoise(title).split(" ").filter(looksLikeModel)))
    .map(normalizeForMatch)
    .filter((model) => model.length >= 4);
}

function normalizeForMatch(value: string) {
  return value.toLowerCase().normalize("NFKC").replace(/[^a-z0-9]/g, "");
}

function modelMatches(models: string[], name: string) {
  if (models.length === 0) return false;

  const normalizedName = normalizeForMatch(name);

  return models.some((model) => normalizedName.includes(model));
}

const ACCESSORY_WORDS = [
  "ケース",
  "カバー",
  "保護フィルム",
  "フィルム",
  "ガラス",
  "互換",
  "アクセサリ",
  "充電器",
  "充電ケーブル",
  "ケーブル",
  "シール",
  "ステッカー",
  "収納",
  "ポーチ",
  "バッグ",
  "グリップ",
  "スキンシール",
  "ストラップ",
  "スペア",
  "替え",
  "補修",
  "部品",
  "パーツ"
];

function isLikelyAccessory(sourceTitle: string, itemName: string) {
  return ACCESSORY_WORDS.some((word) => itemName.includes(word) && !sourceTitle.includes(word));
}

function titleSimilarity(a: string, b: string) {
  const ta = tokenize(a);
  const tb = new Set(tokenize(b));

  if (ta.length === 0 || tb.size === 0) return 0;

  const shared = ta.filter((token) => tb.has(token)).length;

  return shared / ta.length;
}

function tokenize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[【】\[\]()（）]/g, " ")
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .split(" ")
    .filter((token) => token.length >= 2);
}

function medianOf(sorted: number[]) {
  if (sorted.length === 0) return null;

  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) return sorted[mid];

  return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function decToNum(value: { toNumber?: () => number } | number | null | undefined) {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value.toNumber === "function") return value.toNumber();

  return Number(value);
}

function clampInt(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(value)));
}
