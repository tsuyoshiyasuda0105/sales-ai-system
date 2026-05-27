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

  const payload = (await response.json().catch(() => null)) as
    | { data?: NetseaItem[]; next_direct_item_id?: string; message?: string; error?: string }
    | null;

  if (!response.ok) {
    const message = payload?.message ?? payload?.error ?? "NETSEA API request failed.";
    throw new NetseaApiError(String(message), response.status, "netsea_api_error");
  }

  return {
    data: Array.isArray(payload?.data) ? payload.data : [],
    nextDirectItemId: payload?.next_direct_item_id
  };
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
