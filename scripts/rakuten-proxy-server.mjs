import http from "node:http";

const SEARCH_URL_2022 = "https://app.rakuten.co.jp/services/api/IchibaItem/Search/20220601";
const SEARCH_URL_2026 = "https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260401";
const RANKING_URL = "https://openapi.rakuten.co.jp/ichibaranking/api/IchibaItem/Ranking/20220601";

const PORT = Number(process.env.PORT || 8787);
const APPLICATION_ID = process.env.RAKUTEN_APPLICATION_ID || process.env.RAKUTEN_APP_ID;
const ACCESS_KEY = process.env.RAKUTEN_ACCESS_KEY;
const AFFILIATE_ID = process.env.RAKUTEN_AFFILIATE_ID;
const PROXY_API_KEY = process.env.RAKUTEN_PROXY_API_KEY;

const ALLOWED_PARAMS = new Set([
  "age",
  "format",
  "formatVersion",
  "genreId",
  "hits",
  "keyword",
  "maxPrice",
  "minPrice",
  "page",
  "sex",
  "sort"
]);

const OPERATIONS = {
  ichiba_item_search: {
    url: ACCESS_KEY ? SEARCH_URL_2026 : SEARCH_URL_2022,
    defaultParams: {
      format: "json"
    }
  },
  ichiba_item_ranking: {
    url: RANKING_URL,
    defaultParams: {
      format: "json",
      formatVersion: "2"
    }
  }
};

const server = http.createServer(async (request, response) => {
  try {
    if (request.method === "GET" && request.url === "/health") {
      return sendJson(response, 200, { ok: true, service: "rakuten-proxy" });
    }

    if (request.method !== "POST") {
      return sendJson(response, 405, { ok: false, error: { code: "method_not_allowed", message: "Use POST." } });
    }

    if (PROXY_API_KEY && request.headers["x-proxy-api-key"] !== PROXY_API_KEY) {
      return sendJson(response, 401, { ok: false, error: { code: "unauthorized", message: "Invalid proxy API key." } });
    }

    if (!APPLICATION_ID) {
      return sendJson(response, 500, {
        ok: false,
        error: {
          code: "missing_rakuten_application_id",
          message: "RAKUTEN_APPLICATION_ID or RAKUTEN_APP_ID is required on the proxy server."
        }
      });
    }

    const body = await readJsonBody(request);
    const operation = OPERATIONS[body.operation];

    if (!operation) {
      return sendJson(response, 400, {
        ok: false,
        error: { code: "invalid_operation", message: "Unknown Rakuten proxy operation." }
      });
    }

    const rakutenUrl = new URL(operation.url);
    const params = sanitizeParams(body.params);

    for (const [key, value] of Object.entries({ ...operation.defaultParams, ...params })) {
      rakutenUrl.searchParams.set(key, value);
    }

    rakutenUrl.searchParams.set("applicationId", APPLICATION_ID);

    if (ACCESS_KEY) {
      rakutenUrl.searchParams.set("accessKey", ACCESS_KEY);
    }

    if (AFFILIATE_ID) {
      rakutenUrl.searchParams.set("affiliateId", AFFILIATE_ID);
    }

    const upstream = await fetch(rakutenUrl, {
      headers: {
        accept: "application/json"
      }
    });
    const text = await upstream.text();

    response.writeHead(upstream.status, {
      "content-type": upstream.headers.get("content-type") || "application/json",
      "cache-control": "no-store"
    });
    response.end(text);
  } catch (error) {
    sendJson(response, 500, {
      ok: false,
      error: {
        code: "proxy_internal_error",
        message: error instanceof Error ? error.message : "Unknown proxy error."
      }
    });
  }
});

server.listen(PORT, () => {
  console.log(`Rakuten proxy listening on :${PORT}`);
});

function sanitizeParams(params) {
  if (!params || typeof params !== "object" || Array.isArray(params)) {
    return {};
  }

  const sanitized = {};

  for (const [key, value] of Object.entries(params)) {
    if (!ALLOWED_PARAMS.has(key) || value == null) continue;

    sanitized[key] = String(value);
  }

  return sanitized;
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;

    if (size > 64 * 1024) {
      throw new Error("Request body too large.");
    }

    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "content-type": "application/json",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify(payload));
}
