import { badRequest, ok } from "@/lib/api/response";
import { NetseaApiError } from "@/lib/integrations/netsea";
import { sweepNetsea } from "@/lib/sales/netsea-import";

// NETSEA は1ページあたり 100 商品 × 数バリエーション = 100-200 件の永続化が走るため、
// Vercel デフォルトの 10秒では届かない。明示的に 60秒に拡張する
// (Hobby plan は maxDuration の上限が 60秒)。
export const maxDuration = 60;

type RouteParams = {
  params: Promise<{ organizationId: string }>;
};

const ALLOWED_TARGET_CHANNELS = ["amazon_jp", "mercari", "yahoo_auction", "yahoo_shopping", "store"] as const;

export async function POST(request: Request, { params }: RouteParams) {
  const { organizationId } = await params;
  const body = (await request.json().catch(() => null)) as {
    supplierIds?: unknown;
    categoryId?: unknown;
    janCode?: unknown;
    priceFrom?: unknown;
    priceTo?: unknown;
    excludeSoldOut?: unknown;
    netShopOnly?: unknown;
    maxPages?: unknown;
    targetChannel?: unknown;
    discoveredByUserId?: unknown;
  } | null;

  if (!body || typeof body !== "object") {
    return badRequest("JSON body is required.");
  }

  const supplierIds = normalizeSupplierIds(body.supplierIds);
  if (supplierIds.length === 0) {
    return badRequest("supplierIds is required (array or comma-separated string, max 10).");
  }

  const targetChannel = ALLOWED_TARGET_CHANNELS.find((channel) => channel === body.targetChannel);

  try {
    const summary = await sweepNetsea({
      organizationId,
      supplierIds,
      categoryId: parseOptionalInt(body.categoryId),
      janCode: typeof body.janCode === "string" ? body.janCode : undefined,
      priceFrom: parseOptionalInt(body.priceFrom),
      priceTo: parseOptionalInt(body.priceTo),
      excludeSoldOut: body.excludeSoldOut !== false,
      netShopOnly: body.netShopOnly !== false,
      maxPages: parseOptionalInt(body.maxPages),
      targetChannel,
      discoveredByUserId:
        typeof body.discoveredByUserId === "string" ? body.discoveredByUserId : undefined
    });

    return ok({ organizationId, saved: true, ...summary });
  } catch (error) {
    if (error instanceof NetseaApiError) {
      return Response.json(
        { ok: false, error: { code: error.code ?? "netsea_api_error", message: error.message } },
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

function normalizeSupplierIds(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === "string" || typeof entry === "number" ? String(entry).trim() : ""))
      .filter(Boolean)
      .slice(0, 10);
  }
  if (typeof value === "string") {
    return value
      .split(/[,、\s]+/)
      .map((entry) => entry.trim())
      .filter(Boolean)
      .slice(0, 10);
  }
  return [];
}

function parseOptionalInt(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value !== "string" || value.trim() === "") return undefined;
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}
