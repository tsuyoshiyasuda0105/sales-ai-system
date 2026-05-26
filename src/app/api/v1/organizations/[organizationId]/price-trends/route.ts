import { ok } from "@/lib/api/response";
import { getPriceTrends, type PriceTrendChannel } from "@/lib/sales/price-trends";

type RouteParams = {
  params: Promise<{ organizationId: string }>;
};

export async function GET(request: Request, { params }: RouteParams) {
  const { organizationId } = await params;
  const url = new URL(request.url);

  const channelParam = url.searchParams.get("channel");
  const channel: PriceTrendChannel | undefined =
    channelParam === "yahoo_shopping" || channelParam === "rakuten" ? channelParam : undefined;
  const days = parseOptionalInt(url.searchParams.get("days"));
  const minRateAbs = parseOptionalFloat(url.searchParams.get("minRateAbs"));
  const limit = parseOptionalInt(url.searchParams.get("limit"));

  try {
    const result = await getPriceTrends({ organizationId, channel, days, minRateAbs, limit });
    return ok({
      organizationId,
      channel: result.channel,
      days: result.days,
      evaluated: result.evaluated,
      count: result.rows.length,
      rows: result.rows
    });
  } catch (error) {
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

function parseOptionalFloat(value: string | null) {
  if (!value) return undefined;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
