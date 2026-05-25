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

  const [search, ranking] = await Promise.all([diagnoseSearch(), diagnoseRanking()]);

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
        ranking
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
