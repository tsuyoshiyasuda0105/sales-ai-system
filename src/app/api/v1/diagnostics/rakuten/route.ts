import { env } from "@/lib/env";
import { getRakutenRankingItems, searchRakutenItems } from "@/lib/integrations/rakuten";

const RAKUTEN_KEYS = [
  "RAKUTEN_APPLICATION_ID",
  "RAKUTEN_APP_ID",
  "RAKUTEN_ACCESS_KEY",
  "RAKUTEN_AFFILIATE_ID"
] as const;

type RakutenKey = (typeof RAKUTEN_KEYS)[number];

type EnvShape = {
  present: boolean;
  length: number;
  looksLikeAccessKey: boolean;
};

type DirectCheck = {
  ok: boolean;
  status: number | null;
  statusText?: string;
  contentType?: string | null;
  bodyPreview?: string;
};

export async function GET() {
  const envShape = Object.fromEntries(
    RAKUTEN_KEYS.map((key) => [key, summarizeEnv(env[key])])
  ) as Record<RakutenKey, EnvShape>;

  const expectedShape = {
    applicationId:
      envShape.RAKUTEN_APPLICATION_ID.present &&
      !envShape.RAKUTEN_APPLICATION_ID.looksLikeAccessKey,
    appId: envShape.RAKUTEN_APP_ID.present && !envShape.RAKUTEN_APP_ID.looksLikeAccessKey,
    accessKey: envShape.RAKUTEN_ACCESS_KEY.present && envShape.RAKUTEN_ACCESS_KEY.looksLikeAccessKey
  };

  const [search, ranking, directSearch] = await Promise.all([
    diagnoseSearch(),
    diagnoseRanking(),
    diagnoseDirectSearch()
  ]);

  return Response.json({
    ok: search.ok && ranking.ok,
    data: {
      protected: true,
      note: "Temporary diagnostics. No secret values are returned.",
      envShape,
      expectedShape,
      activeApplicationIdSource: env.RAKUTEN_APPLICATION_ID ? "RAKUTEN_APPLICATION_ID" : "RAKUTEN_APP_ID",
      checks: {
        search,
        ranking,
        directSearch
      }
    }
  });
}

async function diagnoseSearch() {
  try {
    const result = await searchRakutenItems({
      keyword: "スイッチ",
      hits: 1
    });

    return {
      ok: true,
      count: result.count,
      returnedItems: result.items.length
    };
  } catch (error) {
    return errorSummary(error);
  }
}

async function diagnoseRanking() {
  try {
    const result = await getRakutenRankingItems({
      genreId: "101205",
      hits: 1
    });

    return {
      ok: true,
      count: result.count,
      returnedItems: result.items.length
    };
  } catch (error) {
    return errorSummary(error);
  }
}

async function diagnoseDirectSearch(): Promise<DirectCheck> {
  const applicationId = env.RAKUTEN_APPLICATION_ID || env.RAKUTEN_APP_ID;
  const accessKey = env.RAKUTEN_ACCESS_KEY;

  if (!applicationId || !accessKey) {
    return {
      ok: false,
      status: null,
      bodyPreview: "RAKUTEN_APPLICATION_ID/RAKUTEN_APP_ID or RAKUTEN_ACCESS_KEY is missing."
    };
  }

  const url = new URL("https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260401");
  url.searchParams.set("format", "json");
  url.searchParams.set("applicationId", applicationId);
  url.searchParams.set("accessKey", accessKey);
  url.searchParams.set("keyword", "スイッチ");
  url.searchParams.set("hits", "1");
  url.searchParams.set("page", "1");

  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        accept: "application/json"
      }
    });
    const body = await response.text();

    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get("content-type"),
      bodyPreview: body.slice(0, 500)
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      bodyPreview: error instanceof Error ? error.message : "Unknown direct fetch error"
    };
  }
}

function errorSummary(error: unknown) {
  return {
    ok: false,
    status: error instanceof Error && "status" in error ? error.status : null,
    message: error instanceof Error ? error.message : "Unknown error"
  };
}

function summarizeEnv(value: string | undefined): EnvShape {
  return {
    present: Boolean(value),
    length: value?.length ?? 0,
    looksLikeAccessKey: value?.startsWith("pk_") ?? false
  };
}
