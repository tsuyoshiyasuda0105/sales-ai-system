"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons";

const DEMO_ORGANIZATION_ID = "00000000-0000-4000-8000-000000000101";
const DEMO_USER_ID = "00000000-0000-4000-8000-000000000001";
const SESSION_API_KEY = "sales-ai-admin-api-key";

type NetseaSweepResponse = {
  ok: boolean;
  data?: {
    pagesFetched: number;
    totalItems: number;
    totalSetEntries: number;
    totalSaved: number;
    nextDirectItemId?: string;
    errors: Array<{ page: number; message: string }>;
  };
  error?: { code: string; message: string };
};

// サーバー側が型通り string を返すべきだが、万一オブジェクトが混入しても
// `[object Object]` を出さないよう保険。JSON 化して読める形にする。
function formatErrorMessage(value: unknown): string {
  if (typeof value === "string" && value.trim()) return value;
  if (value == null) return "(no message)";
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

export function NetseaImportPanel() {
  const [apiKey, setApiKey] = useState("");
  const [supplierIds, setSupplierIds] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [janCode, setJanCode] = useState("");
  const [priceFrom, setPriceFrom] = useState("");
  const [priceTo, setPriceTo] = useState("");
  const [maxPages, setMaxPages] = useState(3);
  const [targetChannel, setTargetChannel] = useState("yahoo_shopping");
  const [excludeSoldOut, setExcludeSoldOut] = useState(true);
  const [netShopOnly, setNetShopOnly] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<NetseaSweepResponse | null>(null);

  useEffect(() => {
    setApiKey(sessionStorage.getItem(SESSION_API_KEY) ?? "");
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResponse(null);

    const trimmedKey = apiKey.trim();
    if (!trimmedKey) {
      setResponse({
        ok: false,
        error: { code: "missing_api_key", message: "管理用APIキーを入力してください。" }
      });
      return;
    }

    const supplierList = supplierIds
      .split(/[,、\s]+/)
      .map((entry) => entry.trim())
      .filter(Boolean);

    if (supplierList.length === 0) {
      setResponse({
        ok: false,
        error: { code: "missing_supplier_ids", message: "サプライヤーIDを1つ以上入力してください。" }
      });
      return;
    }

    // Validate price range ordering — silently swapping would surprise the user, so reject instead.
    const fromNum = priceFrom.trim() ? Number(priceFrom) : null;
    const toNum = priceTo.trim() ? Number(priceTo) : null;
    if (fromNum != null && toNum != null && fromNum > toNum) {
      setResponse({
        ok: false,
        error: {
          code: "invalid_price_range",
          message: `卸価格の下限(${fromNum})が上限(${toNum})より大きいです。値を入れ替えてください。`
        }
      });
      return;
    }

    sessionStorage.setItem(SESSION_API_KEY, trimmedKey);
    setIsLoading(true);

    try {
      const result = await fetch(`/api/v1/organizations/${DEMO_ORGANIZATION_ID}/netsea/sweep`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": trimmedKey },
        body: JSON.stringify({
          supplierIds: supplierList,
          categoryId: categoryId.trim() || undefined,
          janCode: janCode.trim() || undefined,
          priceFrom: priceFrom.trim() || undefined,
          priceTo: priceTo.trim() || undefined,
          maxPages,
          targetChannel,
          excludeSoldOut,
          netShopOnly,
          discoveredByUserId: DEMO_USER_ID
        })
      });

      const payload = (await result.json().catch(() => null)) as NetseaSweepResponse | null;
      setResponse(payload ?? { ok: false, error: { code: "no_payload", message: "応答が不正でした。" } });
    } catch (error) {
      setResponse({
        ok: false,
        error: {
          code: "request_failed",
          message: error instanceof Error ? error.message : "リクエスト失敗"
        }
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="card rakuten-panel" aria-labelledby="netsea-import-title">
      <div className="section-kicker">NETSEA API</div>
      <div className="spread rakuten-panel-head">
        <div>
          <h2 id="netsea-import-title" className="panel-title">
            NETSEA API 直接取り込み
          </h2>
          <p className="muted">
            NETSEA Web API(POST /items)で卸商品を取得し、価格差チャンスとして保存します。
          </p>
        </div>
        <span className="badge info">x-api-key + NETSEA_API_TOKEN</span>
      </div>

      <form className="rakuten-form" onSubmit={handleSubmit}>
        <label className="field field-wide">
          <span className="field-label">管理用APIキー(SALES_API_KEY)</span>
          <input
            className="input"
            type="password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder="Vercelの SALES_API_KEY"
            autoComplete="off"
          />
          <span className="field-help">NETSEA_API_TOKEN はサーバー側 env で設定済みである必要があります。</span>
        </label>

        <label className="field field-wide">
          <span className="field-label">サプライヤーID(必須・最大10件・カンマ区切り)</span>
          <input
            className="input"
            value={supplierIds}
            onChange={(event) => setSupplierIds(event.target.value)}
            placeholder="例: 1000, 2000, 3000"
          />
          <span className="field-help">NETSEAのサプライヤー一覧APIから取得したIDを指定してください。</span>
        </label>

        <label className="field">
          <span className="field-label">カテゴリID(任意)</span>
          <input
            className="input"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            placeholder="例: 20000"
          />
        </label>

        <label className="field">
          <span className="field-label">JANコード(任意)</span>
          <input
            className="input"
            value={janCode}
            onChange={(event) => setJanCode(event.target.value)}
            placeholder="例: 4901234567890"
          />
        </label>

        <label className="field">
          <span className="field-label">卸価格 下限(円)</span>
          <input
            className="input"
            type="number"
            value={priceFrom}
            onChange={(event) => setPriceFrom(event.target.value)}
            placeholder="任意"
            min={0}
          />
        </label>

        <label className="field">
          <span className="field-label">卸価格 上限(円)</span>
          <input
            className="input"
            type="number"
            value={priceTo}
            onChange={(event) => setPriceTo(event.target.value)}
            placeholder="任意"
            min={0}
          />
        </label>

        <label className="field">
          <span className="field-label">最大ページ数(1ページ=100件)</span>
          <input
            className="input"
            type="number"
            value={maxPages}
            onChange={(event) => setMaxPages(Math.max(1, Math.min(20, Number(event.target.value) || 1)))}
            min={1}
            max={20}
          />
        </label>

        <label className="field">
          <span className="field-label">販売先(target)</span>
          <select className="input" value={targetChannel} onChange={(event) => setTargetChannel(event.target.value)}>
            <option value="yahoo_shopping">Yahoo!ショッピング</option>
            <option value="amazon_jp">Amazon JP</option>
            <option value="mercari">メルカリ</option>
            <option value="yahoo_auction">Yahoo!オークション</option>
            <option value="store">自社/店舗</option>
          </select>
        </label>

        <label className="check-row">
          <input
            type="checkbox"
            checked={excludeSoldOut}
            onChange={(event) => setExcludeSoldOut(event.target.checked)}
          />
          <span>売切れ商品を除外する(推奨)</span>
        </label>

        <label className="check-row">
          <input
            type="checkbox"
            checked={netShopOnly}
            onChange={(event) => setNetShopOnly(event.target.checked)}
          />
          <span>ネットショップ販売可の商品のみ(推奨)</span>
        </label>

        <div className="rakuten-form-actions">
          <button className="button" type="submit" disabled={isLoading}>
            {isLoading ? "取得中..." : "NETSEAから取り込む"}
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

      {response?.ok && response.data ? (
        <div className="rakuten-results">
          <div className="spread">
            <div>
              <h3 className="result-title">取り込み結果</h3>
              <p className="muted tiny">
                {response.data.pagesFetched}ページ取得 / 商品 {response.data.totalItems.toLocaleString("ja-JP")}件 /
                バリエーション {response.data.totalSetEntries.toLocaleString("ja-JP")}件 / DB保存{" "}
                {response.data.totalSaved.toLocaleString("ja-JP")}件
                {response.data.nextDirectItemId
                  ? ` / 続き: next_direct_item_id=${response.data.nextDirectItemId}`
                  : ""}
              </p>
            </div>
            <span className="badge good">DB保存済み</span>
          </div>

          {response.data.totalSaved > 0 ? (
            <div className="alert info rakuten-cta" role="status">
              <Icon name="opportunity" />
              <div className="cta-text">
                <div className="alert-title">{response.data.totalSaved}件を仕入れ候補として保存しました</div>
                <div className="alert-body">価格差チャンスで利益・ROI・判定を確認できます。</div>
              </div>
              <Link className="button" href="/opportunities">
                価格差チャンスを見る
              </Link>
            </div>
          ) : null}

          {response.data.errors.length > 0 ? (
            <div className="alert warning rakuten-alert" role="status">
              <Icon name="warning" />
              <div>
                <div className="alert-title">{response.data.errors.length}件のページでエラー</div>
                <div className="alert-body">
                  {response.data.errors
                    .slice(0, 3)
                    .map((entry) => `p${entry.page}: ${formatErrorMessage(entry.message)}`)
                    .join(" / ")}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
