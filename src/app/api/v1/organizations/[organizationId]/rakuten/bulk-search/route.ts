import { badRequest, ok } from "@/lib/api/response";
import { RakutenApiError, searchRakutenItems, type NormalizedRakutenItem } from "@/lib/integrations/rakuten";
import { saveRakutenSearchResults } from "@/lib/sales/rakuten-persistence";

type RouteParams = {
  params: Promise<{ organizationId: string }>;
};

type BulkSearchResult = {
  keyword: string;
  ok: boolean;
  count: number;
  returnedCount: number;
  savedCount: number;
  items: NormalizedRakutenItem[];
  error?: {
    code: string;
    message: string;
  };
};

const MAX_KEYWORDS = 20;
const MAX_HITS_PER_KEYWORD = 10;

export async function POST(request: Request, { params }: RouteParams) {
  const { organizationId } = await params;
  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return badRequest("JSON body is required.");
  }

  const keywords = normalizeKeywords(body.keywords);

  if (keywords.length === 0) {
    return badRequest("keywords must include at least one keyword.");
  }

  if (keywords.length > MAX_KEYWORDS) {
    return badRequest(`keywords must include ${MAX_KEYWORDS} or fewer entries.`);
  }

  const hits = clampInteger(body.hits, 5, 1, MAX_HITS_PER_KEYWORD);
  const save = body.save !== false;
  const targetChannel = normalizeTargetChannel(body.targetChannel);
  const discoveredByUserId = typeof body.discoveredByUserId === "string" ? body.discoveredByUserId : undefined;
  const sort = typeof body.sort === "string" ? body.sort : undefined;
  const genreId = typeof body.genreId === "string" ? body.genreId : undefined;
  const minPrice = parseOptionalInteger(body.minPrice);
  const maxPrice = parseOptionalInteger(body.maxPrice);
  const results: BulkSearchResult[] = [];

  for (const keyword of keywords) {
    try {
      const result = await searchRakutenItems({
        keyword,
        hits,
        page: 1,
        genreId,
        minPrice,
        maxPrice,
        sort
      });

      const savedItems = save
        ? await saveRakutenSearchResults(result.items, {
            organizationId,
            keyword,
            targetChannel,
            discoveredByUserId
          })
        : [];

      results.push({
        keyword,
        ok: true,
        count: result.count,
        returnedCount: result.items.length,
        savedCount: savedItems.length,
        items: result.items
      });
    } catch (error) {
      results.push({
        keyword,
        ok: false,
        count: 0,
        returnedCount: 0,
        savedCount: 0,
        items: [],
        error: normalizeError(error)
      });
    }
  }

  const allItems = dedupeItems(results.flatMap((result) => result.items));
  const succeededCount = results.filter((result) => result.ok).length;
  const failedCount = results.length - succeededCount;

  return ok({
    organizationId,
    keywords,
    saved: save,
    hits,
    keywordCount: keywords.length,
    succeededCount,
    failedCount,
    totalReturnedCount: results.reduce((total, result) => total + result.returnedCount, 0),
    totalSavedCount: results.reduce((total, result) => total + result.savedCount, 0),
    items: allItems,
    results
  });
}

function normalizeKeywords(value: unknown) {
  const rawKeywords = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[\n,]/)
      : [];

  return Array.from(
    new Set(
      rawKeywords
        .map((keyword) => String(keyword).trim())
        .filter(Boolean)
    )
  );
}

function normalizeError(error: unknown) {
  if (error instanceof RakutenApiError) {
    return {
      code: error.code ?? "rakuten_api_error",
      message: error.message
    };
  }

  console.error(error);

  return {
    code: "internal_server_error",
    message: "Unexpected server error."
  };
}

function dedupeItems(items: NormalizedRakutenItem[]) {
  const seen = new Set<string>();

  return items.filter((item) => {
    if (seen.has(item.itemCode)) return false;

    seen.add(item.itemCode);
    return true;
  });
}

function clampInteger(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(String(value ?? ""), 10);

  if (!Number.isFinite(parsed)) return fallback;

  return Math.min(max, Math.max(min, parsed));
}

function parseOptionalInteger(value: unknown) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeTargetChannel(value: unknown) {
  const allowed = ["amazon_jp", "mercari", "yahoo_auction", "yahoo_shopping", "store"] as const;

  return allowed.find((channel) => channel === value);
}
