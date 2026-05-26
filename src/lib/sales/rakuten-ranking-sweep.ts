import { getRakutenRankingItems, RakutenApiError } from "@/lib/integrations/rakuten";
import { saveRakutenSearchResults } from "@/lib/sales/rakuten-persistence";
import type { TargetSalesChannel } from "@/lib/sales/profit";

export type SweptGenreResult = {
  genreId: string;
  label: string;
  itemCount: number;
  savedCount: number;
  error?: string;
};

export type RankingSweepResult = {
  genresProcessed: number;
  genresFailed: number;
  totalItems: number;
  totalSaved: number;
  perGenre: SweptGenreResult[];
};

const SWEEP_GENRES: Array<{ id: string; label: string }> = [
  { id: "101205", label: "ゲーム" },
  { id: "562637", label: "家電" },
  { id: "100939", label: "美容・コスメ" },
  { id: "100026", label: "PC・周辺機器" },
  { id: "564500", label: "スマートフォン" },
  { id: "110667", label: "TV・オーディオ・カメラ" },
  { id: "101213", label: "スポーツ・アウトドア" },
  { id: "100533", label: "食品" },
  { id: "100227", label: "バッグ・小物・ブランド雑貨" },
  { id: "200162", label: "ベビー・キッズ・マタニティ" }
];

const SWEEP_DELAY_MS = 800;

export async function sweepRakutenRanking(options: {
  organizationId: string;
  hits?: number;
  limit?: number;
  targetChannel?: TargetSalesChannel;
  discoveredByUserId?: string;
}): Promise<RankingSweepResult> {
  const hits = clampInt(options.hits ?? 15, 1, 100);
  const limit = clampInt(options.limit ?? 5, 1, SWEEP_GENRES.length);
  const genres = SWEEP_GENRES.slice(0, limit);

  const summary: RankingSweepResult = {
    genresProcessed: 0,
    genresFailed: 0,
    totalItems: 0,
    totalSaved: 0,
    perGenre: []
  };

  for (let i = 0; i < genres.length; i += 1) {
    const genre = genres[i];

    try {
      const ranking = await getRakutenRankingItems({ genreId: genre.id, hits });
      const saved = await saveRakutenSearchResults(ranking.items, {
        organizationId: options.organizationId,
        keyword: `rakuten-ranking-sweep:${genre.id}`,
        targetChannel: options.targetChannel,
        discoveredByUserId: options.discoveredByUserId
      });

      summary.perGenre.push({
        genreId: genre.id,
        label: genre.label,
        itemCount: ranking.items.length,
        savedCount: saved.length
      });
      summary.genresProcessed += 1;
      summary.totalItems += ranking.items.length;
      summary.totalSaved += saved.length;
    } catch (error) {
      const message =
        error instanceof RakutenApiError
          ? `${error.code ?? "rakuten_api_error"}: ${error.message}`
          : error instanceof Error
            ? error.message
            : "unknown error";

      summary.perGenre.push({ genreId: genre.id, label: genre.label, itemCount: 0, savedCount: 0, error: message });
      summary.genresFailed += 1;
    }

    if (i < genres.length - 1) {
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
