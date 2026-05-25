import { env } from "@/lib/env";

const RAKUTEN_ICHIBA_SEARCH_URL_2022 =
  "https://app.rakuten.co.jp/services/api/IchibaItem/Search/20220601";
const RAKUTEN_ICHIBA_SEARCH_URL_2026 =
  "https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260401";
const RAKUTEN_ICHIBA_RANKING_URL =
  "https://openapi.rakuten.co.jp/ichibaranking/api/IchibaItem/Ranking/20220601";

type RakutenProxyOperation = "ichiba_item_search" | "ichiba_item_ranking";

export type RakutenSearchParams = {
  keyword: string;
  hits?: number;
  page?: number;
  genreId?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: string;
};

export type RakutenRankingParams = {
  genreId?: string;
  age?: string;
  sex?: string;
  hits?: number;
};

export type NormalizedRakutenItem = {
  itemCode: string;
  itemName: string;
  itemPrice: number;
  itemUrl: string;
  affiliateUrl?: string;
  imageUrl?: string;
  shopName?: string;
  reviewCount?: number;
  reviewAverage?: number;
  genreId?: string;
  catchcopy?: string;
  availability?: number;
  postageFlag?: number;
  pointRate?: number;
  raw: unknown;
};

type RakutenApiItem = {
  rank?: number;
  itemCode?: string;
  itemName?: string;
  itemPrice?: number;
  itemUrl?: string;
  affiliateUrl?: string;
  mediumImageUrls?: Array<{ imageUrl?: string } | string>;
  smallImageUrls?: Array<{ imageUrl?: string } | string>;
  shopName?: string;
  reviewCount?: number;
  reviewAverage?: number;
  genreId?: string | number;
  catchcopy?: string;
  availability?: number;
  postageFlag?: number;
  pointRate?: number;
};

type RakutenApiResponse = {
  Items?: Array<{ Item?: RakutenApiItem } | RakutenApiItem>;
  items?: Array<{ item?: RakutenApiItem } | RakutenApiItem>;
  count?: number;
  page?: number;
  first?: number;
  last?: number;
  hits?: number;
  carrier?: number;
  pageCount?: number;
};

type RakutenRankingResponse = {
  Items?: Array<{ Item?: RakutenApiItem } | RakutenApiItem>;
  items?: Array<{ item?: RakutenApiItem } | RakutenApiItem>;
  title?: string;
  lastBuildDate?: string;
};

type RakutenErrorResponse = {
  error?: string | { code?: string; message?: string };
  error_description?: string;
  errors?: {
    errorCode?: number;
    errorMessage?: string;
  };
};

export class RakutenApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "RakutenApiError";
    this.status = status;
    this.code = code;
  }
}

export async function searchRakutenItems(params: RakutenSearchParams) {
  const requestParams = new URLSearchParams();
  requestParams.set("format", "json");
  requestParams.set("keyword", params.keyword);
  requestParams.set("hits", String(clamp(params.hits ?? 10, 1, 30)));
  requestParams.set("page", String(Math.max(1, params.page ?? 1)));

  if (params.genreId) {
    requestParams.set("genreId", params.genreId);
  }

  if (Number.isFinite(params.minPrice)) {
    requestParams.set("minPrice", String(params.minPrice));
  }

  if (Number.isFinite(params.maxPrice)) {
    requestParams.set("maxPrice", String(params.maxPrice));
  }

  if (params.sort) {
    requestParams.set("sort", params.sort);
  }

  const url = env.RAKUTEN_PROXY_URL
    ? null
    : buildDirectRakutenUrl(
        env.RAKUTEN_ACCESS_KEY ? RAKUTEN_ICHIBA_SEARCH_URL_2026 : RAKUTEN_ICHIBA_SEARCH_URL_2022,
        requestParams
      );
  const payload = await fetchRakutenPayload<RakutenApiResponse>(
    "ichiba_item_search",
    requestParams,
    url,
    "Rakuten API request failed."
  );
  const data = payload as RakutenApiResponse;

  return {
    count: data.count ?? 0,
    page: data.page ?? params.page ?? 1,
    first: data.first ?? null,
    last: data.last ?? null,
    hits: data.hits ?? params.hits ?? 10,
    pageCount: data.pageCount ?? null,
    items: normalizeRakutenItems(data.Items ?? data.items ?? [])
  };
}

export async function getRakutenRankingItems(params: RakutenRankingParams = {}) {
  const requestParams = new URLSearchParams();
  requestParams.set("format", "json");
  requestParams.set("formatVersion", "2");

  if (params.genreId) {
    requestParams.set("genreId", params.genreId);
  }

  if (params.age) {
    requestParams.set("age", params.age);
  }

  if (params.sex) {
    requestParams.set("sex", params.sex);
  }

  const url = env.RAKUTEN_PROXY_URL ? null : buildDirectRakutenUrl(RAKUTEN_ICHIBA_RANKING_URL, requestParams);
  const payload = await fetchRakutenPayload<RakutenRankingResponse>(
    "ichiba_item_ranking",
    requestParams,
    url,
    "Rakuten ranking API request failed."
  );
  const data = payload as RakutenRankingResponse;
  const allItems = normalizeRakutenItems(data.Items ?? data.items ?? []);
  const hits = clamp(params.hits ?? 30, 1, 100);

  return {
    title: data.title ?? "Rakuten Ranking",
    lastBuildDate: data.lastBuildDate ?? null,
    count: allItems.length,
    hits,
    items: allItems.slice(0, hits)
  };
}

async function fetchRakutenPayload<TPayload>(
  operation: RakutenProxyOperation,
  requestParams: URLSearchParams,
  directUrl: URL | null,
  fallbackErrorMessage: string
) {
  const response = env.RAKUTEN_PROXY_URL
    ? await fetchRakutenViaProxy(operation, requestParams)
    : directUrl
      ? await fetch(directUrl, {
        headers: {
          accept: "application/json"
        },
        next: { revalidate: 300 }
      })
      : null;

  if (!response) {
    throw new RakutenApiError("Rakuten direct URL could not be built.", 500);
  }

  const payload = (await response.json().catch(() => null)) as
    | TPayload
    | RakutenErrorResponse
    | null;

  if (!response.ok) {
    const error = rakutenErrorDetails(payload, fallbackErrorMessage);
    throw new RakutenApiError(error.message, response.status, error.code);
  }

  if (!payload) {
    throw new RakutenApiError("Rakuten API returned an empty or invalid JSON response.", 502);
  }

  return payload as TPayload;
}

async function fetchRakutenViaProxy(operation: RakutenProxyOperation, requestParams: URLSearchParams) {
  if (!env.RAKUTEN_PROXY_URL) {
    throw new RakutenApiError("RAKUTEN_PROXY_URL is not configured.", 500);
  }

  const headers: Record<string, string> = {
    accept: "application/json",
    "content-type": "application/json"
  };

  if (env.RAKUTEN_PROXY_API_KEY) {
    headers["x-proxy-api-key"] = env.RAKUTEN_PROXY_API_KEY;
  }

  return fetch(env.RAKUTEN_PROXY_URL, {
    method: "POST",
    headers,
    cache: "no-store",
    body: JSON.stringify({
      operation,
      params: Object.fromEntries(requestParams)
    })
  });
}

function buildDirectRakutenUrl(baseUrl: string, requestParams: URLSearchParams) {
  const applicationId = env.RAKUTEN_APPLICATION_ID || env.RAKUTEN_APP_ID;

  if (!applicationId) {
    throw new RakutenApiError("RAKUTEN_APPLICATION_ID or RAKUTEN_APP_ID is not configured.", 500);
  }

  const url = new URL(baseUrl);

  for (const [key, value] of requestParams) {
    url.searchParams.set(key, value);
  }

  url.searchParams.set("applicationId", applicationId);

  if (env.RAKUTEN_ACCESS_KEY) {
    url.searchParams.set("accessKey", env.RAKUTEN_ACCESS_KEY);
  }

  if (env.RAKUTEN_AFFILIATE_ID) {
    url.searchParams.set("affiliateId", env.RAKUTEN_AFFILIATE_ID);
  }

  return url;
}

function normalizeRakutenItems(items: RakutenApiResponse["Items"] | RakutenApiResponse["items"]): NormalizedRakutenItem[] {
  return (items ?? [])
    .map(unwrapRakutenItem)
    .filter(isValidRakutenItem)
    .map((item) => ({
      itemCode: item.itemCode ?? "",
      itemName: item.itemName ?? "",
      itemPrice: Number(item.itemPrice ?? 0),
      itemUrl: item.itemUrl ?? "",
      affiliateUrl: item.affiliateUrl,
      imageUrl: firstImageUrl(item.mediumImageUrls) ?? firstImageUrl(item.smallImageUrls),
      shopName: item.shopName,
      reviewCount: item.reviewCount,
      reviewAverage: item.reviewAverage,
      genreId: item.genreId == null ? undefined : String(item.genreId),
      catchcopy: item.catchcopy,
      availability: item.availability,
      postageFlag: item.postageFlag,
      pointRate: item.pointRate,
      raw: item
    }));
}

function unwrapRakutenItem(entry: { Item?: RakutenApiItem; item?: RakutenApiItem } | RakutenApiItem): RakutenApiItem | undefined {
  if ("Item" in entry) {
    return entry.Item;
  }

  if ("item" in entry) {
    return entry.item;
  }

  return entry as RakutenApiItem;
}

function isValidRakutenItem(item: RakutenApiItem | undefined): item is RakutenApiItem {
  return Boolean(item?.itemCode && item.itemName && item.itemUrl);
}

function firstImageUrl(images: RakutenApiItem["mediumImageUrls"]) {
  const first = images?.[0];

  if (!first) return undefined;
  if (typeof first === "string") return first;

  return first.imageUrl;
}

function rakutenErrorDetails(
  payload: unknown,
  fallback = "Rakuten API request failed."
): { code?: string; message: string } {
  const errorPayload = payload as RakutenErrorResponse | null;

  if (errorPayload?.errors?.errorMessage) {
    const code = errorPayload.errors.errorMessage;

    if (code === "CLIENT_IP_NOT_ALLOWED") {
      return {
        code: "client_ip_not_allowed",
        message:
          "Rakuten API rejected the request: CLIENT_IP_NOT_ALLOWED. Vercel's outbound IP is not allowed by the Rakuten application settings. Disable Rakuten IP restriction or use RAKUTEN_PROXY_URL with a fixed-IP proxy."
      };
    }

    return {
      code: code.toLowerCase(),
      message: [code, errorPayload.errors.errorCode].filter(Boolean).join(": ")
    };
  }

  if (errorPayload?.error && typeof errorPayload.error === "object") {
    return {
      code: errorPayload.error.code ?? "rakuten_proxy_error",
      message: errorPayload.error.message ?? fallback
    };
  }

  if (typeof errorPayload?.error === "string") {
    return {
      code: errorPayload.error,
      message: [errorPayload.error, errorPayload.error_description].filter(Boolean).join(": ")
    };
  }

  return {
    code: "rakuten_api_error",
    message: fallback
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
