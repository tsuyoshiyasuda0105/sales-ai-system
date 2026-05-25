import { badRequest, ok } from "@/lib/api/response";
import { searchRakutenItems, RakutenApiError } from "@/lib/integrations/rakuten";
import { saveRakutenSearchResults } from "@/lib/sales/rakuten-persistence";

type RouteParams = {
  params: Promise<{ organizationId: string }>;
};

export async function GET(request: Request, { params }: RouteParams) {
  const { organizationId } = await params;
  const url = new URL(request.url);
  const keyword = url.searchParams.get("keyword")?.trim();

  if (!keyword) {
    return badRequest("keyword is required.");
  }

  try {
    const result = await searchRakutenItems({
      keyword,
      hits: parseInteger(url.searchParams.get("hits"), 10),
      page: parseInteger(url.searchParams.get("page"), 1),
      genreId: url.searchParams.get("genreId") ?? undefined,
      minPrice: parseOptionalInteger(url.searchParams.get("minPrice")),
      maxPrice: parseOptionalInteger(url.searchParams.get("maxPrice")),
      sort: url.searchParams.get("sort") ?? undefined
    });

    return ok({
      organizationId,
      keyword,
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

  const keyword = typeof body.keyword === "string" ? body.keyword.trim() : "";

  if (!keyword) {
    return badRequest("keyword is required.");
  }

  try {
    const result = await searchRakutenItems({
      keyword,
      hits: parseInteger(body.hits, 10),
      page: parseInteger(body.page, 1),
      genreId: typeof body.genreId === "string" ? body.genreId : undefined,
      minPrice: parseOptionalInteger(body.minPrice),
      maxPrice: parseOptionalInteger(body.maxPrice),
      sort: typeof body.sort === "string" ? body.sort : undefined
    });

    const savedItems =
      body.save === false
        ? []
        : await saveRakutenSearchResults(result.items, {
            organizationId,
            keyword,
            targetChannel: normalizeTargetChannel(body.targetChannel),
            discoveredByUserId: typeof body.discoveredByUserId === "string" ? body.discoveredByUserId : undefined
          });

    return ok({
      organizationId,
      keyword,
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

function parseOptionalInteger(value: unknown) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeTargetChannel(value: unknown) {
  const allowed = ["amazon_jp", "mercari", "yahoo_auction", "yahoo_shopping", "store"] as const;

  return allowed.find((channel) => channel === value);
}
