import { badRequest, ok } from "@/lib/api/response";
import { getRakutenRankingItems, RakutenApiError } from "@/lib/integrations/rakuten";
import { saveRakutenSearchResults } from "@/lib/sales/rakuten-persistence";

type RouteParams = {
  params: Promise<{ organizationId: string }>;
};

export async function GET(request: Request, { params }: RouteParams) {
  const { organizationId } = await params;
  const url = new URL(request.url);

  try {
    const result = await getRakutenRankingItems({
      genreId: url.searchParams.get("genreId") ?? undefined,
      age: url.searchParams.get("age") ?? undefined,
      sex: url.searchParams.get("sex") ?? undefined,
      hits: parseInteger(url.searchParams.get("hits"), 30)
    });

    return ok({
      organizationId,
      saved: false,
      ...result
    });
  } catch (error) {
    return handleRakutenError(error);
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  const { organizationId } = await params;
  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return badRequest("JSON body is required.");
  }

  try {
    const result = await getRakutenRankingItems({
      genreId: typeof body.genreId === "string" ? body.genreId : undefined,
      age: typeof body.age === "string" ? body.age : undefined,
      sex: typeof body.sex === "string" ? body.sex : undefined,
      hits: parseInteger(body.hits, 30)
    });

    const savedItems =
      body.save === false
        ? []
        : await saveRakutenSearchResults(result.items, {
            organizationId,
            keyword: rankingImportLabel(body.genreId),
            targetChannel: normalizeTargetChannel(body.targetChannel),
            discoveredByUserId: typeof body.discoveredByUserId === "string" ? body.discoveredByUserId : undefined
          });

    return ok({
      organizationId,
      saved: body.save !== false,
      savedCount: savedItems.length,
      savedItems,
      ...result
    });
  } catch (error) {
    return handleRakutenError(error);
  }
}

function handleRakutenError(error: unknown) {
  if (error instanceof RakutenApiError) {
    return Response.json(
      {
        ok: false,
        error: {
          code: error.code ?? "rakuten_api_error",
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

function parseInteger(value: unknown, fallback: number) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeTargetChannel(value: unknown) {
  const allowed = ["amazon_jp", "mercari", "yahoo_auction", "yahoo_shopping", "store"] as const;

  return allowed.find((channel) => channel === value);
}

function rankingImportLabel(genreId: unknown) {
  return typeof genreId === "string" && genreId.trim()
    ? `rakuten-ranking:${genreId.trim()}`
    : "rakuten-ranking:all";
}
