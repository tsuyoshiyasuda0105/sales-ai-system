"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

const DEMO_ORGANIZATION_ID = "00000000-0000-4000-8000-000000000101";
const DEMO_USER_ID = "00000000-0000-4000-8000-000000000001";
const SESSION_API_KEY = "sales-ai-admin-api-key";

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
  postageFlag?: number;
};

type RakutenSearchResponse = {
  ok: boolean;
  data?: {
    keyword: string;
    count: number;
    page: number;
    hits: number;
    pageCount: number | null;
    saved: boolean;
    savedCount?: number;
    items: RakutenItem[];
  };
  error?: {
    code: string;
    message: string;
  };
};

export function RakutenSearchPanel() {
  const [apiKey, setApiKey] = useState("");
  const [keyword, setKeyword] = useState("joy-con");
  const [hits, setHits] = useState(10);
  const [targetChannel, setTargetChannel] = useState("amazon_jp");
  const [sort, setSort] = useState("");
  const [save, setSave] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<RakutenSearchResponse | null>(null);

  useEffect(() => {
    setApiKey(sessionStorage.getItem(SESSION_API_KEY) ?? "");
  }, []);

  const summary = useMemo(() => {
    if (!response?.data) return null;

    const savedLabel = response.data.saved ? `${response.data.savedCount ?? 0}件をDB保存` : "DB保存なし";

    return `${response.data.count.toLocaleString("ja-JP")}件中 ${response.data.items.length}件表示 / ${savedLabel}`;
  }, [response]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResponse(null);

    const trimmedApiKey = apiKey.trim();
    const trimmedKeyword = keyword.trim();

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

    if (!trimmedKeyword) {
      setResponse({
        ok: false,
        error: {
          code: "missing_keyword",
          message: "検索キーワードを入力してください。"
        }
      });
      return;
    }

    sessionStorage.setItem(SESSION_API_KEY, trimmedApiKey);
    setIsLoading(true);

    try {
      const result = await fetch(`/api/v1/organizations/${DEMO_ORGANIZATION_ID}/rakuten/search`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": trimmedApiKey
        },
        body: JSON.stringify({
          keyword: trimmedKeyword,
          hits,
          page: 1,
          sort: sort || undefined,
          save,
          targetChannel,
          discoveredByUserId: DEMO_USER_ID
        })
      });

      const payload = (await result.json().catch(() => null)) as RakutenSearchResponse | null;

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
      <div className="section-kicker">Rakuten API</div>
      <div className="spread rakuten-panel-head">
        <div>
          <h2 id="rakuten-search-title" className="panel-title">
            楽天商品検索
          </h2>
          <p className="muted">
            APIキーで保護されたまま、管理画面から楽天市場の商品候補を検索してDBへ保存できます。
          </p>
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

        <label className="field field-wide">
          <span className="field-label">検索キーワード</span>
          <input
            className="input"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="例: joy-con, EH-NA0J, TS8530"
          />
        </label>

        <label className="field">
          <span className="field-label">取得件数</span>
          <input
            className="input"
            type="number"
            min={1}
            max={30}
            value={hits}
            onChange={(event) => setHits(Number(event.target.value))}
          />
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

        <label className="check-row">
          <input type="checkbox" checked={save} onChange={(event) => setSave(event.target.checked)} />
          <span>検索結果を商品・市場価格・仕入れ候補としてDB保存する</span>
        </label>

        <div className="rakuten-form-actions">
          <button className="button" type="submit" disabled={isLoading}>
            {isLoading ? "検索中..." : "楽天検索を実行"}
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
            <div className="alert-title">検索できませんでした</div>
            <div className="alert-body">
              {response.error.message}
              {response.error.code === "rakuten_api_error"
                ? " RAKUTEN_APP_ID / RAKUTEN_APPLICATION_ID と Access Key の設定も確認してください。"
                : ""}
            </div>
          </div>
        </div>
      ) : null}

      {response?.data ? (
        <div className="rakuten-results">
          <div className="spread">
            <div>
              <h3 className="result-title">検索結果</h3>
              <p className="muted tiny">{summary}</p>
            </div>
            <span className={response.data.saved ? "badge good" : "badge neutral"}>
              {response.data.saved ? "DB保存済み" : "プレビュー"}
            </span>
          </div>

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
        </div>
      ) : null}
    </section>
  );
}

function formatYen(amount: number) {
  return `${amount.toLocaleString("ja-JP")}円`;
}
