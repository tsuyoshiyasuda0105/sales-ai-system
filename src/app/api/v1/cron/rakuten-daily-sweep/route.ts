import { ok } from "@/lib/api/response";
import { env } from "@/lib/env";
import { RakutenApiError } from "@/lib/integrations/rakuten";
import { sweepRakutenRanking } from "@/lib/sales/rakuten-ranking-sweep";
import { pruneOldMarketPrices } from "@/lib/sales/market-prices-retention";

const DEMO_ORGANIZATION_ID = "00000000-0000-4000-8000-000000000101";
const RETENTION_KEEP = 30;

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

  try {
    const sweep = await sweepRakutenRanking({ organizationId, hits, limit });
    const pruned = await pruneOldMarketPrices(organizationId, { keepPerProductChannel });

    return ok({ organizationId, saved: true, ...sweep, pruned });
  } catch (error) {
    if (error instanceof RakutenApiError) {
      return Response.json(
        { ok: false, error: { code: error.code ?? "rakuten_api_error", message: error.message } },
        { status: error.status }
      );
    }

    console.error(error);

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
