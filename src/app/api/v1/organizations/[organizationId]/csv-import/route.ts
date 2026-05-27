import { badRequest, ok } from "@/lib/api/response";
import {
  saveSupplierCatalogItems,
  type SupplierImportItem,
  type SupplierName
} from "@/lib/sales/supplier-import";

type RouteParams = {
  params: Promise<{ organizationId: string }>;
};

const ALLOWED_SUPPLIERS: SupplierName[] = ["netsea", "cj", "topseller", "other"];
const ALLOWED_TARGET_CHANNELS = ["amazon_jp", "mercari", "yahoo_auction", "yahoo_shopping", "store"] as const;
const MAX_ROWS = 1000;

export async function POST(request: Request, { params }: RouteParams) {
  const { organizationId } = await params;
  const body = (await request.json().catch(() => null)) as {
    supplier?: unknown;
    targetChannel?: unknown;
    discoveredByUserId?: unknown;
    rows?: unknown;
  } | null;

  if (!body || typeof body !== "object") {
    return badRequest("JSON body is required.");
  }

  const supplier = ALLOWED_SUPPLIERS.find((s) => s === body.supplier);
  if (!supplier) {
    return badRequest(`supplier must be one of: ${ALLOWED_SUPPLIERS.join(", ")}`);
  }

  if (!Array.isArray(body.rows)) {
    return badRequest("rows must be an array.");
  }

  if (body.rows.length === 0) {
    return badRequest("rows must contain at least 1 item.");
  }

  if (body.rows.length > MAX_ROWS) {
    return badRequest(`rows can contain at most ${MAX_ROWS} items per request.`);
  }

  const targetChannel = ALLOWED_TARGET_CHANNELS.find((c) => c === body.targetChannel);
  const discoveredByUserId = typeof body.discoveredByUserId === "string" ? body.discoveredByUserId : undefined;

  const { items, rejected } = normalizeRows(body.rows);

  if (items.length === 0) {
    return badRequest(`No valid rows found. Rejected: ${rejected.length}.`);
  }

  try {
    const saved = await saveSupplierCatalogItems(items, {
      organizationId,
      supplier,
      targetChannel,
      discoveredByUserId
    });

    return ok({
      organizationId,
      supplier,
      targetChannel: targetChannel ?? "yahoo_shopping",
      totalRows: body.rows.length,
      acceptedRows: items.length,
      rejectedRows: rejected.length,
      rejectionReasons: rejected.slice(0, 10),
      savedCount: saved.length,
      savedItems: saved
    });
  } catch (error) {
    console.error(error);
    return Response.json(
      { ok: false, error: { code: "internal_server_error", message: "Unexpected server error." } },
      { status: 500 }
    );
  }
}

function normalizeRows(rawRows: unknown[]): {
  items: SupplierImportItem[];
  rejected: Array<{ index: number; reason: string }>;
} {
  const items: SupplierImportItem[] = [];
  const rejected: Array<{ index: number; reason: string }> = [];

  for (let i = 0; i < rawRows.length; i += 1) {
    const row = rawRows[i] as Record<string, unknown> | null;

    if (!row || typeof row !== "object") {
      rejected.push({ index: i, reason: "not an object" });
      continue;
    }

    const title = trimString(row.title) ?? trimString(row["商品名"]);
    const supplierPrice = parseMoney(row.supplier_price ?? row["卸価格"] ?? row["仕入価格"]);

    if (!title) {
      rejected.push({ index: i, reason: "title missing" });
      continue;
    }
    if (supplierPrice == null || supplierPrice <= 0) {
      rejected.push({ index: i, reason: "supplier_price missing or non-positive" });
      continue;
    }

    items.push({
      jan: trimString(row.jan ?? row["JAN"] ?? row["jan_code"]),
      supplierSku: trimString(row.sku ?? row["sku"] ?? row["商品コード"]),
      title,
      supplierPrice,
      supplierShippingCost: parseMoney(row.supplier_shipping_cost ?? row["送料"]) ?? undefined,
      supplierUrl: trimString(row.supplier_url ?? row["url"] ?? row["商品URL"]),
      stockQty: parseInt32(row.stock_qty ?? row["在庫"] ?? row["在庫数"]),
      condition: trimString(row.condition ?? row["状態"]) as
        | "new"
        | "used"
        | "unknown"
        | undefined,
      imageUrl: trimString(row.image_url ?? row["画像URL"]),
      notes: trimString(row.notes ?? row["備考"])
    });
  }

  return { items, rejected };
}

function trimString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseMoney(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;
  const cleaned = value.replace(/[¥,円\s]/g, "");
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseInt32(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value !== "string") return undefined;
  const parsed = Number.parseInt(value.replace(/,/g, ""), 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}
