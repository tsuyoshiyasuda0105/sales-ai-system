import { ok } from "@/lib/api/response";
import { YahooApiError } from "@/lib/integrations/yahoo-shopping";
import { refreshYahooSellPrices } from "@/lib/sales/yahoo-sell-price";

type RouteParams = {
  params: Promise<{ organizationId: string }>;
};

export async function POST(request: Request, { params }: RouteParams) {
  const { organizationId } = await params;
  const body = (await request.json().catch(() => ({}))) as { limit?: unknown } | null;

  const limit = parseOptionalInteger(body?.limit);

  try {
    const summary = await refreshYahooSellPrices(organizationId, { limit });

    return ok({ organizationId, ...summary });
  } catch (error) {
    if (error instanceof YahooApiError) {
      return Response.json(
        {
          ok: false,
          error: {
            code: error.code ?? "yahoo_api_error",
            message: error.message
          }
        },
        { status: error.status }
      );
    }

    console.error(error);

    return Response.json(
      {
        ok: false,
        error: {
          code: "internal_server_error",
          message: "Unexpected server error."
        }
      },
      { status: 500 }
    );
  }
}

function parseOptionalInteger(value: unknown) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}
