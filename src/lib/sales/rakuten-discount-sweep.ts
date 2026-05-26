import { searchRakutenItems, RakutenApiError } from "@/lib/integrations/rakuten";
import { saveRakutenSearchResults } from "@/lib/sales/rakuten-persistence";
import type { TargetSalesChannel } from "@/lib/sales/profit";

export type DiscountKeywordResult = {
  keyword: string;
  fetched: number;
  matched: number;
  saved: number;
  topPointRate: number | null;
  error?: string;
};

export type DiscountSweepResult = {
  keywordsProcessed: number;
  keywordsFailed: number;
  totalFetched: number;
  totalMatched: number;
  totalSaved: number;
  minPointRate: number;
  perKeyword: DiscountKeywordResult[];
};

const DEFAULT_DISCOUNT_KEYWORDS: string[] = [
  "ポイント10倍",
  "ポイント20倍",
  "ポイント30倍",
  "アウトレット",
  "限定特価",
  "半額",
  "在庫処分",
  "クーポン適用",
  "スーパーDEAL",
  "ポイント50倍"
];

const SWEEP_DELAY_MS = 900;

/**
 * Searches Rakuten with discount-related keywords, post-filters by pointRate ≥ minPointRate,
 * and saves the matched items via the standard persistence pipeline. Throttled at 900ms
 * between keywords to respect Rakuten's per-app rate cap.
 */
export async function sweepRakutenDiscounts(options: {
  organizationId: string;
  hits?: number;
  limit?: number;
  minPointRate?: number;
  targetChannel?: TargetSalesChannel;
  discoveredByUserId?: string;
}): Promise<DiscountSweepResult> {
  const hits = clampInt(options.hits ?? 15, 1, 30);
  const limit = clampInt(options.limit ?? 4, 1, DEFAULT_DISCOUNT_KEYWORDS.length);
  const minPointRate = Math.max(1, options.minPointRate ?? 5);
  const keywords = DEFAULT_DISCOUNT_KEYWORDS.slice(0, limit);

  const summary: DiscountSweepResult = {
    keywordsProcessed: 0,
    keywordsFailed: 0,
    totalFetched: 0,
    totalMatched: 0,
    totalSaved: 0,
    minPointRate,
    perKeyword: []
  };

  for (let i = 0; i < keywords.length; i += 1) {
    const keyword = keywords[i];

    try {
      const result = await searchRakutenItems({ keyword, hits, sort: "-reviewCount" });
      const matched = result.items.filter((item) => (item.pointRate ?? 1) >= minPointRate);
      const topPointRate =
        result.items.length > 0 ? Math.max(...result.items.map((item) => item.pointRate ?? 1)) : null;

      let savedCount = 0;
      if (matched.length > 0) {
        const saved = await saveRakutenSearchResults(matched, {
          organizationId: options.organizationId,
          keyword: `rakuten-discount:${keyword}`,
          targetChannel: options.targetChannel,
          discoveredByUserId: options.discoveredByUserId
        });
        savedCount = saved.length;
      }

      summary.perKeyword.push({
        keyword,
        fetched: result.items.length,
        matched: matched.length,
        saved: savedCount,
        topPointRate
      });
      summary.keywordsProcessed += 1;
      summary.totalFetched += result.items.length;
      summary.totalMatched += matched.length;
      summary.totalSaved += savedCount;
    } catch (error) {
      const message =
        error instanceof RakutenApiError
          ? `${error.code ?? "rakuten_api_error"}: ${error.message}`
          : error instanceof Error
            ? error.message
            : "unknown error";

      summary.perKeyword.push({
        keyword,
        fetched: 0,
        matched: 0,
        saved: 0,
        topPointRate: null,
        error: message
      });
      summary.keywordsFailed += 1;
    }

    if (i < keywords.length - 1) {
      await sleep(SWEEP_DELAY_MS);
    }
  }

  return summary;
}

function clampInt(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
