import { ok } from "@/lib/api/response";
import { RakutenApiError } from "@/lib/integrations/rakuten";
import { sweepRakutenDiscounts } from "@/lib/sales/rakuten-discount-sweep";
import { pruneOldMarketPrices } from "@/lib/sales/market-prices-retention";

type RouteParams = {
  params: Promise<{ organizationId: string }>;
};

const ALLOWED_TARGET_CHANNELS = ["amazon_jp", "mercari", "yahoo_auction", "yahoo_shopping", "store"] as const;

export async function POST(request: Request, { params }: RouteParams) {
  const { organizationId } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    hits?: unknown;
    limit?: unknown;
    minPointRate?: unknown;
    targetChannel?: unknown;
    discoveredByUserId?: unknown;
    prune?: unknown;
    keepPerProductChannel?: unknown;
  } | null;

  const hits = parseOptionalInteger(body?.hits);
  const limit = parseOptionalInteger(body?.limit);
  const minPointRate = parseOptionalInteger(body?.minPointRate);
  const keepPerProductChannel = parseOptionalInteger(body?.keepPerProductChannel);
  const prune = body?.prune !== false;

  try {
    const sweep = await sweepRakutenDiscounts({
      organizationId,
      hits,
      limit,
      minPointRate,
      targetChannel: normalizeTargetChannel(body?.targetChannel),
      discoveredByUserId:
        typeof body?.discoveredByUserId === "string" ? body.discoveredByUserId : undefined
    });

    const pruned = prune
      ? await pruneOldMarketPrices(organizationId, {
          keepPerProductChannel: keepPerProductChannel ?? 30
        })
      : null;

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

function parseOptionalInteger(value: unknown) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeTargetChannel(value: unknown) {
  return ALLOWED_TARGET_CHANNELS.find((channel) => channel === value);
}
