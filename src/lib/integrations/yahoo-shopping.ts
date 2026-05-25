import { env } from "@/lib/env";

const YAHOO_ITEM_SEARCH_URL = "https://shopping.yahooapis.jp/ShoppingWebService/V3/itemSearch";

export type YahooSearchParams = {
  query?: string;
  janCode?: string;
  hits?: number;
  conditionNew?: boolean;
  inStockOnly?: boolean;
  sort?: string;
};

export type NormalizedYahooItem = {
  name: string;
  price: number;
  url: string;
  storeName?: string;
  janCode?: string;
  code?: string;
  condition?: string;
  inStock?: boolean;
  reviewCount?: number;
  reviewRate?: number;
  imageUrl?: string;
  raw: unknown;
};

export type YahooSearchResult = {
  totalAvailable: number;
  items: NormalizedYahooItem[];
};

type YahooApiHit = {
  name?: string;
  url?: string;
  price?: number;
  code?: string;
  janCode?: string;
  condition?: string;
  inStock?: boolean;
  review?: { rate?: number; count?: number };
  image?: { small?: string; medium?: string };
  seller?: { name?: string };
};

type YahooApiResponse = {
  totalResultsAvailable?: number;
  totalResultsReturned?: number;
  hits?: YahooApiHit[];
};

type YahooErrorResponse = {
  Status?: number;
  Message?: string;
  Error?: { Message?: string; Code?: string | number };
  ResultInfo?: { Errors?: Array<{ Message?: string }> };
};

export class YahooApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "YahooApiError";
    this.status = status;
    this.code = code;
  }
}

export async function searchYahooItems(params: YahooSearchParams): Promise<YahooSearchResult> {
  const appid = env.YAHOO_CLIENT_ID;

  if (!appid) {
    throw new YahooApiError("YAHOO_CLIENT_ID is not configured.", 500, "missing_yahoo_app_id");
  }

  const trimmedQuery = params.query?.trim();

  if (!params.janCode && !trimmedQuery) {
    throw new YahooApiError("query or janCode is required.", 400, "missing_query");
  }

  const url = new URL(YAHOO_ITEM_SEARCH_URL);
  url.searchParams.set("appid", appid);

  if (params.janCode) {
    url.searchParams.set("jan_code", params.janCode);
  } else if (trimmedQuery) {
    url.searchParams.set("query", trimmedQuery);
  }

  url.searchParams.set("results", String(clamp(params.hits ?? 20, 1, 50)));
  url.searchParams.set("sort", params.sort ?? "+price");

  if (params.conditionNew) {
    url.searchParams.set("condition", "new");
  }

  if (params.inStockOnly) {
    url.searchParams.set("in_stock", "true");
  }

  let response: Response;

  try {
    response = await fetch(url, { headers: { accept: "application/json" }, cache: "no-store" });
  } catch (error) {
    throw new YahooApiError(
      error instanceof Error ? error.message : "Yahoo Shopping API request failed.",
      502,
      "request_failed"
    );
  }

  const payload = (await response.json().catch(() => null)) as YahooApiResponse | YahooErrorResponse | null;

  if (!response.ok) {
    const details = yahooErrorDetails(payload, response.status);
    throw new YahooApiError(details.message, response.status, details.code);
  }

  if (!payload) {
    throw new YahooApiError("Yahoo Shopping API returned an invalid JSON response.", 502, "invalid_response");
  }

  const data = payload as YahooApiResponse;
  const hits = Array.isArray(data.hits) ? data.hits : [];

  return {
    totalAvailable: data.totalResultsAvailable ?? hits.length,
    items: hits.map(normalizeYahooItem).filter((item): item is NormalizedYahooItem => item !== null)
  };
}

function normalizeYahooItem(hit: YahooApiHit): NormalizedYahooItem | null {
  const price = Number(hit.price ?? 0);

  if (!hit.name || !hit.url || !Number.isFinite(price) || price <= 0) {
    return null;
  }

  return {
    name: hit.name,
    price,
    url: hit.url,
    storeName: hit.seller?.name,
    janCode: hit.janCode || undefined,
    code: hit.code,
    condition: hit.condition,
    inStock: hit.inStock,
    reviewCount: hit.review?.count,
    reviewRate: hit.review?.rate,
    imageUrl: hit.image?.medium ?? hit.image?.small,
    raw: hit
  };
}

function yahooErrorDetails(payload: unknown, httpStatus?: number): { code?: string; message: string } {
  const error = payload as YahooErrorResponse | null;
  const rawMessage = error?.Message ?? error?.Error?.Message ?? error?.ResultInfo?.Errors?.[0]?.Message;
  const status = error?.Status ?? httpStatus;

  if (status === 429 || (rawMessage != null && /limit count|denied|too many/i.test(rawMessage))) {
    return {
      code: "rate_limited",
      message: "Yahoo!ショッピングAPIの呼び出し上限に達しました。時間をおいてから再度お試しください。"
    };
  }

  if (rawMessage) {
    return { code: "yahoo_api_error", message: rawMessage };
  }

  return { code: "yahoo_api_error", message: "Yahoo Shopping API request failed." };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
