import { ok } from "@/lib/api/response";
import { env } from "@/lib/env";
import { RakutenApiError } from "@/lib/integrations/rakuten";
import { sweepRakutenRanking } from "@/lib/sales/rakuten-ranking-sweep";
import { pruneOldMarketPrices } from "@/lib/sales/market-prices-retention";
import { refreshYahooSellPrices, type YahooRefreshSummary } from "@/lib/sales/yahoo-sell-price";
import { notifyError } from "@/lib/notify";

const DEMO_ORGANIZATION_ID = "00000000-0000-4000-8000-000000000101";
const RETENTION_KEEP = 30;
// Vercel Hobby は cron 2本までの制約があるので、Yahoo 実売価格更新は
// この daily-sweep に相乗りさせる。limit を小さくとって全体で 10秒以内に
// 収まるよう調整(rakuten 1.5-2s + prune <1s + yahoo ~1.5s = ~5s)。
const YAHOO_REFRESH_LIMIT = 6;

/**
 * Daily cron entry-point invoked by Vercel Cron. Vercel sets
 *   Authorization: Bearer ${CRON_SECRET}
 * automatically when the CRON_SECRET env var is configured, so we verify
 * that header before doing any work.
 */
export async function GET(request: Request) {
  if (!env.CRON_SECRET) {
    return Response.json(
      {
        ok: false,
        error: { code: "server_misconfigured", message: "CRON_SECRET is not configured." }
      },
      { status: 500 }
    );
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${env.CRON_SECRET}`) {
    return Response.json(
      { ok: false, error: { code: "unauthorized", message: "Invalid cron secret." } },
      { status: 401 }
    );
  }

  const url = new URL(request.url);
  const organizationId = url.searchParams.get("organizationId") ?? DEMO_ORGANIZATION_ID;
  const hits = parseOptionalInt(url.searchParams.get("hits")) ?? 15;
  const limit = parseOptionalInt(url.searchParams.get("limit")) ?? 5;
  const keepPerProductChannel =
    parseOptionalInt(url.searchParams.get("keep")) ?? RETENTION_KEEP;
  // テスト/緊急時に override できるようパラメータ化。0 で yahoo refresh をスキップ。
  const yahooLimit = parseOptionalInt(url.searchParams.get("yahooLimit")) ?? YAHOO_REFRESH_LIMIT;

  try {
    const sweep = await sweepRakutenRanking({ organizationId, hits, limit });
    const pruned = await pruneOldMarketPrices(organizationId, { keepPerProductChannel });

    // Yahoo refresh は daily-sweep の最後で実行。Yahoo API でエラーになっても
    // rakuten データの保存はすでに済んでいるので、catch して結果に含めるだけ。
    // updated_at asc で取得するので、毎日少しずつ rotation する。
    let yahooRefresh: YahooRefreshSummary | null = null;
    let yahooError: string | null = null;

    if (yahooLimit > 0) {
      try {
        yahooRefresh = await refreshYahooSellPrices(organizationId, { limit: yahooLimit });
      } catch (error) {
        yahooError = error instanceof Error ? error.message : String(error);
        await notifyError(error, {
          source: "cron/rakuten-daily-sweep#yahoo-refresh",
          extra: { organizationId, yahooLimit }
        });
      }
    }

    return ok({
      organizationId,
      saved: true,
      ...sweep,
      pruned,
      yahooRefresh,
      yahooError
    });
  } catch (error) {
    if (error instanceof RakutenApiError) {
      await notifyError(error, {
        source: "cron/rakuten-daily-sweep",
        extra: { organizationId, code: error.code, status: error.status }
      });
      return Response.json(
        { ok: false, error: { code: error.code ?? "rakuten_api_error", message: error.message } },
        { status: error.status }
      );
    }

    await notifyError(error, {
      source: "cron/rakuten-daily-sweep",
      extra: { organizationId }
    });

    return Response.json(
      { ok: false, error: { code: "internal_server_error", message: "Unexpected server error." } },
      { status: 500 }
    );
  }
}

function parseOptionalInt(value: string | null) {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}
