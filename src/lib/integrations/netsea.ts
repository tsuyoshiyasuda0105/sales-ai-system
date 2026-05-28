import { env } from "@/lib/env";

export type NetseaSetEntry = {
  direct_item_id: string;
  branch_code?: string;
  jan_code?: string;
  label?: string;
  reference_price?: number;
  price?: number; // 税抜
  set_num?: number;
  set_price?: number; // 税込
  set_price_without_tax?: number;
  set_price_tax?: number;
  consumption_tax_class?: number;
  sold_out_flag?: "Y" | "N";
};

export type NetseaItem = {
  supplier_id: number;
  product_id?: string;
  product_url: string;
  product_name: string;
  shop_name?: string;
  jan_code?: string;
  category_id?: string;
  description?: string;
  spec_size?: string;
  reference_price_type?: string;
  delivery_terms?: string;
  ship_fee_type?: string; // "N" など
  ship_fee?: number;
  image_url_1?: string;
  image_url_2?: string;
  deal_net_shop_flag?: "Y" | "N";
  deal_net_auction_flag?: "Y" | "N";
  net_bulk_order_flag?: "Y" | "N";
  set?: NetseaSetEntry[];
};

export type NetseaItemSearchParams = {
  supplierIds?: string;
  directItemIds?: string;
  productId?: string;
  janCode?: string;
  categoryId?: number;
  branchCode?: string;
  label?: string;
  priceFrom?: number;
  priceTo?: number;
  setNum?: number;
  dealNetShopFlag?: "Y" | "N";
  dealNetAuctionFlag?: "Y" | "N";
  soldOutFlag?: "Y" | "N";
  netBulkOrderFlag?: "Y" | "N";
  createDateFrom?: string;
  createDateTo?: string;
  updateDateFrom?: string;
  updateDateTo?: string;
  nextDirectItemId?: string;
};

export type NetseaItemSearchResult = {
  data: NetseaItem[];
  nextDirectItemId?: string;
};

export class NetseaApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "NetseaApiError";
    this.status = status;
    this.code = code;
  }
}

function requireBaseUrlAndToken(): { baseUrl: string; token: string } {
  if (!env.NETSEA_API_BASE_URL) {
    throw new NetseaApiError("NETSEA_API_BASE_URL is not configured.", 500, "missing_base_url");
  }
  if (!env.NETSEA_API_TOKEN) {
    throw new NetseaApiError("NETSEA_API_TOKEN is not configured.", 500, "missing_token");
  }

  return {
    baseUrl: env.NETSEA_API_BASE_URL.replace(/\/+$/, ""),
    token: env.NETSEA_API_TOKEN
  };
}

/**
 * POST /items with application/x-www-form-urlencoded body, as documented in the NETSEA Web API spec.
 * Returns up to 100 items per page; use the returned next_direct_item_id to paginate.
 */
export async function searchNetseaItems(params: NetseaItemSearchParams): Promise<NetseaItemSearchResult> {
  const { baseUrl, token } = requireBaseUrlAndToken();

  if (!params.supplierIds && !params.directItemIds) {
    throw new NetseaApiError(
      "supplier_ids or direct_item_ids is required (max 10 IDs comma-separated).",
      400,
      "missing_required_id"
    );
  }

  const form = new URLSearchParams();
  if (params.supplierIds) form.set("supplier_ids", params.supplierIds);
  if (params.directItemIds) form.set("direct_item_ids", params.directItemIds);
  if (params.productId) form.set("product_id", params.productId);
  if (params.janCode) form.set("jan_code", params.janCode);
  if (params.categoryId != null) form.set("category_id", String(params.categoryId));
  if (params.branchCode) form.set("branch_code", params.branchCode);
  if (params.label) form.set("label", params.label);
  if (params.priceFrom != null) form.set("price_from", String(params.priceFrom));
  if (params.priceTo != null) form.set("price_to", String(params.priceTo));
  if (params.setNum != null) form.set("set_num", String(params.setNum));
  if (params.dealNetShopFlag) form.set("deal_net_shop_flag", params.dealNetShopFlag);
  if (params.dealNetAuctionFlag) form.set("deal_net_auction_flag", params.dealNetAuctionFlag);
  if (params.soldOutFlag) form.set("sold_out_flag", params.soldOutFlag);
  if (params.netBulkOrderFlag) form.set("net_bulk_order_flag", params.netBulkOrderFlag);
  if (params.createDateFrom) form.set("create_date_from", params.createDateFrom);
  if (params.createDateTo) form.set("create_date_to", params.createDateTo);
  if (params.updateDateFrom) form.set("update_date_from", params.updateDateFrom);
  if (params.updateDateTo) form.set("update_date_to", params.updateDateTo);
  if (params.nextDirectItemId) form.set("next_direct_item_id", params.nextDirectItemId);

  let response: Response;

  try {
    response = await fetch(`${baseUrl}/items`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: form.toString(),
      cache: "no-store"
    });
  } catch (error) {
    throw new NetseaApiError(
      error instanceof Error ? error.message : "NETSEA API request failed.",
      502,
      "request_failed"
    );
  }

  // NETSEA は成功時 { data: [...], next_direct_item_id } / 失敗時 message or error フィールド を返す
  // が、実際には {message: {code:..., detail:...}} のようなネスト形式や {errors:[...]} の配列形式
  // で返してくるケースが観測されている。任意形を文字列化できるよう柔軟に処理する。
  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    const message = extractNetseaErrorMessage(payload, response.status);
    // 生 payload は Vercel ログに残しておく。後で同じエラーを再現するときに役立つ。
    console.error("[netsea] non-ok response:", { status: response.status, payload });
    throw new NetseaApiError(message, response.status, "netsea_api_error");
  }

  const data = (payload as { data?: NetseaItem[]; next_direct_item_id?: string } | null) ?? {};

  return {
    data: Array.isArray(data.data) ? data.data : [],
    nextDirectItemId: data.next_direct_item_id
  };
}

/**
 * Pull a human-readable error string out of whatever shape NETSEA returned.
 * Falls back to a JSON dump of the whole payload so the UI never has to show "[object Object]".
 */
function extractNetseaErrorMessage(payload: unknown, httpStatus: number): string {
  const fallback = `NETSEA API returned HTTP ${httpStatus}.`;

  if (payload == null || typeof payload !== "object") {
    return fallback;
  }

  const p = payload as Record<string, unknown>;

  // 1. 直接 string 形式: { message: "..." } または { error: "..." }
  if (typeof p.message === "string" && p.message.trim()) return `[${httpStatus}] ${p.message.trim()}`;
  if (typeof p.error === "string" && p.error.trim()) return `[${httpStatus}] ${p.error.trim()}`;

  // 2. オブジェクト形式: { message: { code, detail } } や { error: { ... } }
  if (p.message && typeof p.message === "object") {
    return `[${httpStatus}] ${safeJsonStringify(p.message)}`;
  }
  if (p.error && typeof p.error === "object") {
    return `[${httpStatus}] ${safeJsonStringify(p.error)}`;
  }

  // 3. 配列形式: { errors: [{ message, detail }, ...] }
  if (Array.isArray(p.errors) && p.errors.length > 0) {
    const first = p.errors[0];
    if (typeof first === "string") return `[${httpStatus}] ${first}`;
    if (first && typeof first === "object") {
      const obj = first as Record<string, unknown>;
      if (typeof obj.message === "string") return `[${httpStatus}] ${obj.message}`;
      return `[${httpStatus}] ${safeJsonStringify(first)}`;
    }
  }

  // 4. 最後の手段: payload 全体を一部だけ書き出す
  return `[${httpStatus}] ${safeJsonStringify(payload)}`;
}

function safeJsonStringify(value: unknown): string {
  try {
    const json = JSON.stringify(value);
    return json.length > 240 ? `${json.slice(0, 240)}…` : json;
  } catch {
    return String(value);
  }
}

/** GET /item/stock?direct_item_id=X */
export async function getNetseaItemStock(directItemId: string): Promise<{ direct_item_id: string; sold_out_flag: "Y" | "N" }> {
  const { baseUrl, token } = requireBaseUrlAndToken();

  const url = new URL(`${baseUrl}/item/stock`);
  url.searchParams.set("direct_item_id", directItemId);

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    cache: "no-store"
  });

  const payload = (await response.json().catch(() => null)) as {
    direct_item_id?: string;
    sold_out_flag?: "Y" | "N";
    message?: string;
  } | null;

  if (!response.ok) {
    throw new NetseaApiError(payload?.message ?? "NETSEA stock API failed.", response.status, "netsea_stock_error");
  }

  return {
    direct_item_id: payload?.direct_item_id ?? directItemId,
    sold_out_flag: payload?.sold_out_flag ?? "N"
  };
}
