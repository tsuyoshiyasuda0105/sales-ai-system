import { env } from "@/lib/env";

const RAKUTEN_ICHIBA_SEARCH_URL_2022 =
  "https://app.rakuten.co.jp/services/api/IchibaItem/Search/20220601";
const RAKUTEN_ICHIBA_SEARCH_URL_2026 =
  "https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260401";
const RAKUTEN_ICHIBA_RANKING_URL =
  "https://openapi.rakuten.co.jp/ichibaranking/api/IchibaItem/Ranking/20220601";

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
  error?: string;
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
  const applicationId = env.RAKUTEN_APPLICATION_ID || env.RAKUTEN_APP_ID;
  const accessKey = env.RAKUTEN_ACCESS_KEY;

  if (!applicationId) {
    throw new RakutenApiError("RAKUTEN_APPLICATION_ID or RAKUTEN_APP_ID is not configured.", 500);
  }

  const url = new URL(accessKey ? RAKUTEN_ICHIBA_SEARCH_URL_2026 : RAKUTEN_ICHIBA_SEARCH_URL_2022);
  url.searchParams.set("format", "json");
  url.searchParams.set("applicationId", applicationId);
  url.searchParams.set("keyword", params.keyword);
  url.searchParams.set("hits", String(clamp(params.hits ?? 10, 1, 30)));
  url.searchParams.set("page", String(Math.max(1, params.page ?? 1)));

  if (env.RAKUTEN_AFFILIATE_ID) {
    url.searchParams.set("affiliateId", env.RAKUTEN_AFFILIATE_ID);
  }

  if (accessKey) {
    url.searchParams.set("accessKey", accessKey);
  }

  if (params.genreId) {
    url.searchParams.set("genreId", params.genreId);
  }

  if (Number.isFinite(params.minPrice)) {
    url.searchParams.set("minPrice", String(params.minPrice));
  }

  if (Number.isFinite(params.maxPrice)) {
    url.searchParams.set("maxPrice", String(params.maxPrice));
  }

  if (params.sort) {
    url.searchParams.set("sort", params.sort);
  }

  const response = await fetch(url, {
    headers: {
      accept: "application/json"
    },
    next: { revalidate: 300 }
  });

  const payload = (await response.json().catch(() => null)) as RakutenApiResponse | RakutenErrorResponse | null;

  if (!response.ok) {
    const error = rakutenErrorDetails(payload);
    throw new RakutenApiError(error.message, response.status, error.code);
  }

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
  const applicationId = env.RAKUTEN_APPLICATION_ID || env.RAKUTEN_APP_ID;
  const accessKey = env.RAKUTEN_ACCESS_KEY;

  if (!applicationId) {
    throw new RakutenApiError("RAKUTEN_APPLICATION_ID or RAKUTEN_APP_ID is not configured.", 500);
  }

  const url = new URL(RAKUTEN_ICHIBA_RANKING_URL);
  url.searchParams.set("format", "json");
  url.searchParams.set("formatVersion", "2");
  url.searchParams.set("applicationId", applicationId);

  if (accessKey) {
    url.searchParams.set("accessKey", accessKey);
  }

  if (env.RAKUTEN_AFFILIATE_ID) {
    url.searchParams.set("affiliateId", env.RAKUTEN_AFFILIATE_ID);
  }

  if (params.genreId) {
    url.searchParams.set("genreId", params.genreId);
  }

  if (params.age) {
    url.searchParams.set("age", params.age);
  }

  if (params.sex) {
    url.searchParams.set("sex", params.sex);
  }

  const response = await fetch(url, {
    headers: {
      accept: "application/json"
    },
    next: { revalidate: 300 }
  });

  const payload = (await response.json().catch(() => null)) as RakutenRankingResponse | RakutenErrorResponse | null;

  if (!response.ok) {
    const error = rakutenErrorDetails(payload, "Rakuten ranking API request failed.");
    throw new RakutenApiError(error.message, response.status, error.code);
  }

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
  payload: RakutenApiResponse | RakutenRankingResponse | RakutenErrorResponse | null,
  fallback = "Rakuten API request failed."
) {
  if (payload && "errors" in payload && payload.errors?.errorMessage) {
    const code = payload.errors.errorMessage;

    if (code === "CLIENT_IP_NOT_ALLOWED") {
      return {
        code: "client_ip_not_allowed",
        message:
          "Rakuten API rejected the request: CLIENT_IP_NOT_ALLOWED. Vercel の送信元IPが楽天アプリ側で許可されていません。楽天アプリのIP制限を解除するか、固定IPのバックエンドから実行してください。"
      };
    }

    return {
      code: code.toLowerCase(),
      message: [code, payload.errors.errorCode].filter(Boolean).join(": ")
    };
  }

  if (payload && "error" in payload && payload.error) {
    return {
      code: payload.error,
      message: [payload.error, payload.error_description].filter(Boolean).join(": ")
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
