"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons";

const DEMO_ORGANIZATION_ID = "00000000-0000-4000-8000-000000000101";
const DEMO_USER_ID = "00000000-0000-4000-8000-000000000001";
const SESSION_API_KEY = "sales-ai-admin-api-key";

const GENRES = [
  { label: "総合ランキング", value: "" },
  { label: "ゲーム", value: "101205" },
  { label: "家電", value: "562637" },
  { label: "美容・コスメ", value: "100939" },
  { label: "PC・周辺機器", value: "100026" },
  { label: "スマートフォン", value: "564500" }
];

type SourceMode =
  | "rakuten-ranking"
  | "rakuten-ranking-sweep"
  | "rakuten-discount-sweep"
  | "manual"
  | "bulk"
  | "yahoo-keywords"
  | "google-trends";

type SweptGenreResult = {
  genreId: string;
  label: string;
  itemCount: number;
  savedCount: number;
  error?: string;
};

type DiscountKeywordResult = {
  keyword: string;
  fetched: number;
  matched: number;
  saved: number;
  topPointRate: number | null;
  error?: string;
};

type RakutenItem = {
  itemCode: string;
  itemName: string;
  itemPrice: number;
  itemUrl: string;
  affiliateUrl?: string;
  imageUrl?: string;
  shopName?: string;
  reviewCount?: number;
  reviewAverage?: number;
  pointRate?: number;
};

type KeywordResult = {
  keyword: string;
  ok: boolean;
  count: number;
  returnedCount: number;
  savedCount: number;
  error?: {
    code: string;
    message: string;
  };
};

type ApiResponse = {
  ok: boolean;
  data?: {
    keyword?: string;
    keywords?: string[];
    title?: string;
    count?: number;
    page?: number;
    hits?: number;
    pageCount?: number | null;
    saved?: boolean;
    savedCount?: number;
    totalReturnedCount?: number;
    totalSavedCount?: number;
    keywordCount?: number;
    succeededCount?: number;
    failedCount?: number;
    items?: RakutenItem[];
    results?: KeywordResult[];
    // ranking-sweep:
    genresProcessed?: number;
    genresFailed?: number;
    totalItems?: number;
    totalSaved?: number;
    perGenre?: SweptGenreResult[];
    pruned?: { deletedCount: number; keepPerProductChannel: number } | null;
    // discount-sweep:
    keywordsProcessed?: number;
    keywordsFailed?: number;
    totalFetched?: number;
    totalMatched?: number;
    minPointRate?: number;
    perKeyword?: DiscountKeywordResult[];
  };
  error?: {
    code: string;
    message: string;
  };
};

export function RakutenSearchPanel() {
  const [apiKey, setApiKey] = useState("");
  const [mode, setMode] = useState<SourceMode>("rakuten-ranking");
  const [keyword, setKeyword] = useState("joy-con");
  const [bulkKeywords, setBulkKeywords] = useState("joy-con\nスイッチ\nプリンター");
  const [genreId, setGenreId] = useState("");
  const [hits, setHits] = useState(10);
  const [targetChannel, setTargetChannel] = useState("amazon_jp");
  const [sort, setSort] = useState("");
  const [save, setSave] = useState(true);
  const [minPointRate, setMinPointRate] = useState(5);
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<ApiResponse | null>(null);

  useEffect(() => {
    setApiKey(sessionStorage.getItem(SESSION_API_KEY) ?? "");
  }, []);

  const summary = useMemo(() => {
    if (!response?.data) return null;

    if (mode === "rakuten-discount-sweep") {
      const processed = response.data.keywordsProcessed ?? 0;
      const failed = response.data.keywordsFailed ?? 0;
      const fetched = response.data.totalFetched ?? 0;
      const matched = response.data.totalMatched ?? 0;
      const saved = response.data.totalSaved ?? 0;
      const pruned = response.data.pruned?.deletedCount ?? 0;
      const threshold = response.data.minPointRate ?? 0;
      return `${processed}キーワード処理(失敗${failed}) / 取得 ${fetched.toLocaleString(
        "ja-JP"
      )}件 / ${threshold}倍以上 ${matched.toLocaleString("ja-JP")}件 / DB保存 ${saved.toLocaleString(
        "ja-JP"
      )}件 / 古い価格スナップ ${pruned}件を削除`;
    }

    if (mode === "rakuten-ranking-sweep") {
      const processed = response.data.genresProcessed ?? 0;
      const failed = response.data.genresFailed ?? 0;
      const items = response.data.totalItems ?? 0;
      const saved = response.data.totalSaved ?? 0;
      const pruned = response.data.pruned?.deletedCount ?? 0;
      return `${processed}ジャンル処理(失敗${failed}) / 取得 ${items.toLocaleString(
        "ja-JP"
      )}件 / DB保存 ${saved.toLocaleString("ja-JP")}件 / 古い価格スナップ ${pruned}件を削除`;
    }

    if (mode === "bulk") {
      const totalReturned = response.data.totalReturnedCount ?? response.data.items?.length ?? 0;
      const totalSaved = response.data.totalSavedCount ?? response.data.savedCount ?? 0;

      return `${response.data.keywordCount ?? 0}キーワード / 成功 ${
        response.data.succeededCount ?? 0
      }件 / 取得 ${totalReturned.toLocaleString("ja-JP")}件 / DB保存 ${totalSaved}件`;
    }

    const sourceLabel =
      mode === "rakuten-ranking"
        ? response.data.title ?? "楽天ランキング"
        : response.data.keyword
          ? `キーワード ${response.data.keyword}`
          : "検索結果";
    const savedLabel = response.data.saved ? `${response.data.savedCount ?? 0}件をDB保存` : "DB保存なし";

    return `${sourceLabel} / ${(response.data.count ?? 0).toLocaleString("ja-JP")}件中 ${
      response.data.items?.length ?? 0
    }件表示 / ${savedLabel}`;
  }, [mode, response]);

  const savedTotal = useMemo(() => {
    if (!response?.data) return 0;

    if (mode === "rakuten-ranking-sweep" || mode === "rakuten-discount-sweep") {
      return response.data.totalSaved ?? 0;
    }

    if (!response.data.saved) return 0;

    if (mode === "bulk") {
      return response.data.totalSavedCount ?? response.data.savedCount ?? 0;
    }

    return response.data.savedCount ?? 0;
  }, [mode, response]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResponse(null);

    const trimmedApiKey = apiKey.trim();

    if (!trimmedApiKey) {
      setResponse({
        ok: false,
        error: {
          code: "missing_api_key",
          message: "管理用APIキーを入力してください。Vercelの SALES_API_KEY と同じ値です。"
        }
      });
      return;
    }

    if (mode === "yahoo-keywords" || mode === "google-trends") {
      setResponse({
        ok: false,
        error: {
          code: "source_not_ready",
          message:
            mode === "yahoo-keywords"
              ? "Yahoo!人気キーワード連携は次フェーズで実装します。"
              : "Googleトレンド連携は次フェーズで実装します。"
        }
      });
      return;
    }

    const trimmedKeyword = keyword.trim();
    const normalizedBulkKeywords = splitKeywords(bulkKeywords);

    if (mode === "manual" && !trimmedKeyword) {
      setResponse({
        ok: false,
        error: {
          code: "missing_keyword",
          message: "手入力検索ではキーワードを入力してください。"
        }
      });
      return;
    }

    if (mode === "bulk" && normalizedBulkKeywords.length === 0) {
      setResponse({
        ok: false,
        error: {
          code: "missing_keywords",
          message: "複数キーワード検索では1件以上のキーワードを入力してください。"
        }
      });
      return;
    }

    sessionStorage.setItem(SESSION_API_KEY, trimmedApiKey);
    setIsLoading(true);

    try {
      const endpoint = endpointForMode(mode);
      const body = requestBodyForMode(mode, {
        keyword: trimmedKeyword,
        keywords: normalizedBulkKeywords,
        genreId,
        hits,
        save,
        sort,
        targetChannel,
        minPointRate
      });

      const result = await fetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": trimmedApiKey
        },
        body: JSON.stringify(body)
      });

      const payload = (await result.json().catch(() => null)) as ApiResponse | null;

      if (!payload) {
        throw new Error("API response was not JSON.");
      }

      setResponse(payload);
    } catch (error) {
      setResponse({
        ok: false,
        error: {
          code: "request_failed",
          message: error instanceof Error ? error.message : "検索リクエストに失敗しました。"
        }
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="card rakuten-panel" aria-labelledby="rakuten-search-title">
      <div className="section-kicker">Sourcing Input</div>
      <div className="spread rakuten-panel-head">
        <div>
          <h2 id="rakuten-search-title" className="panel-title">
            仕入れ候補取得
          </h2>
          <p className="muted">楽天市場の商品候補を取得して、商品・市場価格・仕入れ候補としてDB保存します。</p>
        </div>
        <span className="badge info">x-api-key required</span>
      </div>

      <form className="rakuten-form" onSubmit={handleSubmit}>
        <label className="field field-wide">
          <span className="field-label">管理用APIキー</span>
          <input
            className="input"
            type="password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder="Vercelの SALES_API_KEY"
            autoComplete="off"
          />
          <span className="field-help">このタブの sessionStorage にだけ保持します。</span>
        </label>

        <fieldset className="source-radio-group">
          <legend className="field-label">取得元</legend>
          <label className="radio-option">
            <input
              type="radio"
              name="source-mode"
              value="rakuten-ranking"
              checked={mode === "rakuten-ranking"}
              onChange={() => setMode("rakuten-ranking")}
            />
            <span>楽天ランキング</span>
          </label>
          <label className="radio-option">
            <input
              type="radio"
              name="source-mode"
              value="rakuten-ranking-sweep"
              checked={mode === "rakuten-ranking-sweep"}
              onChange={() => setMode("rakuten-ranking-sweep")}
            />
            <span>楽天ランキング横断(主要ジャンル)</span>
          </label>
          <label className="radio-option">
            <input
              type="radio"
              name="source-mode"
              value="rakuten-discount-sweep"
              checked={mode === "rakuten-discount-sweep"}
              onChange={() => setMode("rakuten-discount-sweep")}
            />
            <span>楽天高ポイント品(ポイント倍率で絞り込み)</span>
          </label>
          <label className="radio-option">
            <input
              type="radio"
              name="source-mode"
              value="manual"
              checked={mode === "manual"}
              onChange={() => setMode("manual")}
            />
            <span>単一キーワード</span>
          </label>
          <label className="radio-option">
            <input
              type="radio"
              name="source-mode"
              value="bulk"
              checked={mode === "bulk"}
              onChange={() => setMode("bulk")}
            />
            <span>複数キーワード</span>
          </label>
          <label className="radio-option">
            <input
              type="radio"
              name="source-mode"
              value="yahoo-keywords"
              checked={mode === "yahoo-keywords"}
              onChange={() => setMode("yahoo-keywords")}
            />
            <span>Yahoo!人気キーワード</span>
            <em>準備中</em>
          </label>
          <label className="radio-option">
            <input
              type="radio"
              name="source-mode"
              value="google-trends"
              checked={mode === "google-trends"}
              onChange={() => setMode("google-trends")}
            />
            <span>Googleトレンド</span>
            <em>準備中</em>
          </label>
        </fieldset>

        {mode === "rakuten-ranking" ? (
          <label className="field">
            <span className="field-label">ジャンル</span>
            <select className="input" value={genreId} onChange={(event) => setGenreId(event.target.value)}>
              {GENRES.map((genre) => (
                <option value={genre.value} key={genre.value || "all"}>
                  {genre.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {mode === "rakuten-discount-sweep" ? (
          <label className="field">
            <span className="field-label">ポイント倍率の最低値</span>
            <input
              className="input"
              type="number"
              min={1}
              max={50}
              value={minPointRate}
              onChange={(event) => setMinPointRate(Math.max(1, Math.min(50, Number(event.target.value) || 1)))}
            />
            <span className="field-help">{minPointRate}倍以上の商品だけを候補入りさせます。</span>
          </label>
        ) : null}

        {mode === "manual" ? (
          <label className="field field-wide">
            <span className="field-label">検索キーワード</span>
            <input
              className="input"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="例: joy-con, EH-NA0J, TS8530"
            />
          </label>
        ) : null}

        {mode === "bulk" ? (
          <label className="field field-wide">
            <span className="field-label">複数キーワード</span>
            <textarea
              className="input"
              value={bulkKeywords}
              onChange={(event) => setBulkKeywords(event.target.value)}
              rows={5}
              placeholder={"joy-con\nスイッチ\nプリンター"}
              style={{ minHeight: 132, resize: "vertical" }}
            />
            <span className="field-help">改行またはカンマ区切りで最大20件まで。</span>
          </label>
        ) : null}

        <label className="field">
          <span className="field-label">取得件数</span>
          <input
            className="input"
            type="number"
            min={1}
            max={
              mode === "rakuten-ranking"
                ? 100
                : mode === "rakuten-ranking-sweep"
                  ? 30
                  : mode === "bulk"
                    ? 10
                    : 30
            }
            value={hits}
            onChange={(event) => setHits(Number(event.target.value))}
          />
          <span className="field-help">
            {mode === "rakuten-ranking"
              ? "ランキング: 1〜100件"
              : mode === "rakuten-ranking-sweep"
                ? "横断: 各ジャンル最大30件 × 5ジャンル"
                : mode === "rakuten-discount-sweep"
                  ? "高ポイント: 各キーワード最大30件 × 4キーワード"
                  : mode === "bulk"
                    ? "複数キーワード: 1キーワードあたり1〜10件 × 最大20キーワード"
                    : "単一キーワード: 1〜30件"}
          </span>
        </label>

        <label className="field">
          <span className="field-label">販売先</span>
          <select className="input" value={targetChannel} onChange={(event) => setTargetChannel(event.target.value)}>
            <option value="amazon_jp">Amazon JP</option>
            <option value="mercari">メルカリ</option>
            <option value="yahoo_auction">Yahoo!オークション</option>
            <option value="yahoo_shopping">Yahoo!ショッピング</option>
            <option value="store">自社/店舗</option>
          </select>
        </label>

        {mode === "manual" || mode === "bulk" ? (
          <label className="field">
            <span className="field-label">並び順</span>
            <select className="input" value={sort} onChange={(event) => setSort(event.target.value)}>
              <option value="">標準</option>
              <option value="+itemPrice">価格が安い順</option>
              <option value="-itemPrice">価格が高い順</option>
              <option value="-reviewCount">レビュー数が多い順</option>
              <option value="-reviewAverage">レビュー評価が高い順</option>
            </select>
          </label>
        ) : null}

        <label className="check-row">
          <input type="checkbox" checked={save} onChange={(event) => setSave(event.target.checked)} />
          <span>取得結果を商品・市場価格・仕入れ候補としてDB保存する</span>
        </label>

        <div className="rakuten-form-actions">
          <button className="button" type="submit" disabled={isLoading}>
            {buttonLabel(mode, isLoading)}
          </button>
          <button
            className="button secondary"
            type="button"
            onClick={() => {
              sessionStorage.removeItem(SESSION_API_KEY);
              setApiKey("");
            }}
          >
            キーを消去
          </button>
        </div>
      </form>

      {response?.error ? (
        <div className="alert danger rakuten-alert" role="alert">
          <div>
            <div className="alert-title">取得できませんでした</div>
            <div className="alert-body">{response.error.message}</div>
          </div>
        </div>
      ) : null}

      {response?.data ? (
        <div className="rakuten-results">
          <div className="spread">
            <div>
              <h3 className="result-title">取得結果</h3>
              <p className="muted tiny">{summary}</p>
            </div>
            <span className={response.data.saved ? "badge good" : "badge neutral"}>
              {response.data.saved ? "DB保存済み" : "プレビュー"}
            </span>
          </div>

          {savedTotal > 0 ? (
            <div className="alert info rakuten-cta" role="status">
              <Icon name="opportunity" />
              <div className="cta-text">
                <div className="alert-title">{savedTotal}件を仕入れ候補として保存しました</div>
                <div className="alert-body">価格差チャンスと商品一覧で、利益・ROI・A/B/C/NG判定を確認できます。</div>
              </div>
              <Link className="button" href="/opportunities">
                価格差チャンスを見る
              </Link>
              <Link className="button secondary" href="/products">
                商品一覧
              </Link>
            </div>
          ) : null}

          {response.data.results ? <KeywordSummary results={response.data.results} /> : null}

          {response.data.perGenre ? <GenreSweepSummary results={response.data.perGenre} /> : null}

          {response.data.perKeyword ? <DiscountSweepSummary results={response.data.perKeyword} /> : null}

          {response.data.items && response.data.items.length > 0 ? (
            <div className="table-wrap rakuten-table">
              <table className="table">
                <thead>
                  <tr>
                    <th>商品</th>
                    <th>店舗</th>
                    <th className="num">価格</th>
                    <th className="num">ポイント</th>
                    <th className="num">レビュー</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {response.data.items.map((item) => (
                  <tr key={item.itemCode}>
                    <td>
                      <div className="rakuten-product-cell">
                        {item.imageUrl ? <img src={item.imageUrl} alt="" className="rakuten-thumb" /> : null}
                        <div>
                          <div className="cell-main">{item.itemName}</div>
                          <span className="cell-sub">{item.itemCode}</span>
                        </div>
                      </div>
                    </td>
                    <td>{item.shopName ?? "-"}</td>
                    <td className="num strong">{formatYen(item.itemPrice)}</td>
                    <td className="num">{item.pointRate ? `${item.pointRate}%` : "-"}</td>
                    <td className="num">
                      {item.reviewAverage ? `${item.reviewAverage} / ${item.reviewCount ?? 0}件` : "-"}
                    </td>
                    <td className="num">
                      <a
                        className="button ghost"
                        href={item.affiliateUrl || item.itemUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        開く
                      </a>
                    </td>
                  </tr>
                ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function DiscountSweepSummary({ results }: { results: DiscountKeywordResult[] }) {
  return (
    <div className="table-wrap rakuten-table">
      <table className="table">
        <thead>
          <tr>
            <th>キーワード</th>
            <th className="num">取得</th>
            <th className="num">最大倍率</th>
            <th className="num">条件一致</th>
            <th className="num">保存</th>
            <th>状態</th>
          </tr>
        </thead>
        <tbody>
          {results.map((row) => (
            <tr key={row.keyword}>
              <td className="cell-main">{row.keyword}</td>
              <td className="num">{row.fetched}</td>
              <td className="num">{row.topPointRate != null ? `${row.topPointRate}倍` : "—"}</td>
              <td className="num">{row.matched}</td>
              <td className="num">{row.saved}</td>
              <td>
                {row.error ? (
                  <span className="badge risk">{row.error}</span>
                ) : (
                  <span className="badge good">成功</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GenreSweepSummary({ results }: { results: SweptGenreResult[] }) {
  return (
    <div className="table-wrap rakuten-table">
      <table className="table">
        <thead>
          <tr>
            <th>ジャンル</th>
            <th className="num">取得</th>
            <th className="num">保存</th>
            <th>状態</th>
          </tr>
        </thead>
        <tbody>
          {results.map((row) => (
            <tr key={row.genreId}>
              <td>
                <span className="cell-main">{row.label}</span>
                <span className="cell-sub">genreId: {row.genreId}</span>
              </td>
              <td className="num">{row.itemCount}</td>
              <td className="num">{row.savedCount}</td>
              <td>{row.error ? <span className="badge risk">{row.error}</span> : <span className="badge good">成功</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function KeywordSummary({ results }: { results: KeywordResult[] }) {
  return (
    <div className="table-wrap rakuten-table">
      <table className="table">
        <thead>
          <tr>
            <th>キーワード</th>
            <th className="num">取得</th>
            <th className="num">保存</th>
            <th>状態</th>
          </tr>
        </thead>
        <tbody>
          {results.map((result) => (
            <tr key={result.keyword}>
              <td>{result.keyword}</td>
              <td className="num">{result.returnedCount}</td>
              <td className="num">{result.savedCount}</td>
              <td>{result.ok ? "成功" : result.error?.message ?? "失敗"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function endpointForMode(mode: SourceMode) {
  if (mode === "rakuten-discount-sweep") {
    return `/api/v1/organizations/${DEMO_ORGANIZATION_ID}/rakuten/discount-sweep`;
  }

  if (mode === "rakuten-ranking-sweep") {
    return `/api/v1/organizations/${DEMO_ORGANIZATION_ID}/rakuten/ranking-sweep`;
  }

  if (mode === "rakuten-ranking") {
    return `/api/v1/organizations/${DEMO_ORGANIZATION_ID}/rakuten/ranking`;
  }

  if (mode === "bulk") {
    return `/api/v1/organizations/${DEMO_ORGANIZATION_ID}/rakuten/bulk-search`;
  }

  return `/api/v1/organizations/${DEMO_ORGANIZATION_ID}/rakuten/search`;
}

function requestBodyForMode(
  mode: SourceMode,
  values: {
    keyword: string;
    keywords: string[];
    genreId: string;
    hits: number;
    save: boolean;
    sort: string;
    targetChannel: string;
    minPointRate: number;
  }
) {
  if (mode === "rakuten-discount-sweep") {
    return {
      hits: values.hits,
      limit: 4,
      minPointRate: values.minPointRate,
      save: values.save,
      targetChannel: values.targetChannel,
      discoveredByUserId: DEMO_USER_ID,
      prune: true
    };
  }

  if (mode === "rakuten-ranking-sweep") {
    return {
      hits: values.hits,
      limit: 5,
      save: values.save,
      targetChannel: values.targetChannel,
      discoveredByUserId: DEMO_USER_ID,
      prune: true
    };
  }

  if (mode === "rakuten-ranking") {
    return {
      genreId: values.genreId || undefined,
      hits: values.hits,
      save: values.save,
      targetChannel: values.targetChannel,
      discoveredByUserId: DEMO_USER_ID
    };
  }

  if (mode === "bulk") {
    return {
      keywords: values.keywords,
      hits: values.hits,
      sort: values.sort || undefined,
      save: values.save,
      targetChannel: values.targetChannel,
      discoveredByUserId: DEMO_USER_ID
    };
  }

  return {
    keyword: values.keyword,
    hits: values.hits,
    page: 1,
    sort: values.sort || undefined,
    save: values.save,
    targetChannel: values.targetChannel,
    discoveredByUserId: DEMO_USER_ID
  };
}

function buttonLabel(mode: SourceMode, isLoading: boolean) {
  if (isLoading) return "取得中...";
  if (mode === "rakuten-discount-sweep") return "高ポイント品を取得";
  if (mode === "rakuten-ranking-sweep") return "主要ジャンル横断取得";
  if (mode === "rakuten-ranking") return "ランキングから候補取得";
  if (mode === "bulk") return "まとめて候補取得";

  return "候補を取得";
}

function splitKeywords(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\n,]/)
        .map((keyword) => keyword.trim())
        .filter(Boolean)
    )
  );
}

function formatYen(amount: number) {
  return `${amount.toLocaleString("ja-JP")}円`;
}
