"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons";

const DEMO_ORGANIZATION_ID = "00000000-0000-4000-8000-000000000101";
const DEMO_USER_ID = "00000000-0000-4000-8000-000000000001";
const SESSION_API_KEY = "sales-ai-admin-api-key";
const MAX_PREVIEW_ROWS = 5;

const COLUMN_HINTS = [
  "title",
  "supplier_price",
  "jan",
  "sku",
  "supplier_shipping_cost",
  "supplier_url",
  "stock_qty",
  "condition",
  "image_url",
  "notes"
];

const SAMPLE_CSV = `title,supplier_price,jan,sku,supplier_shipping_cost,supplier_url,stock_qty,condition,image_url
パナソニック EH-NA0K ヘアドライヤー,42000,4549077123456,NETSEA-EHNA0K-001,0,https://www.netsea.jp/shop/.../EHNA0K,12,new,
SanDisk microSD Express 256GB,5800,,SD-MSDE-256,500,https://www.netsea.jp/shop/.../SD256,30,new,`;

type SupplierName = "netsea" | "cj" | "topseller" | "other";

type ParsedRow = Record<string, string>;

type SaveResult = {
  ok: boolean;
  data?: {
    supplier: string;
    targetChannel: string;
    totalRows: number;
    acceptedRows: number;
    rejectedRows: number;
    rejectionReasons: Array<{ index: number; reason: string }>;
    savedCount: number;
    savedItems: Array<{
      title: string;
      supplierPrice: number;
      targetExpectedPrice: number | null;
      estimatedProfit: number | null;
      estimatedRoi: number | null;
    }>;
  };
  error?: { code: string; message: string };
};

export function SupplierImportPanel() {
  const [apiKey, setApiKey] = useState("");
  const [supplier, setSupplier] = useState<SupplierName>("netsea");
  const [targetChannel, setTargetChannel] = useState("yahoo_shopping");
  const [csvText, setCsvText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<SaveResult | null>(null);

  useEffect(() => {
    setApiKey(sessionStorage.getItem(SESSION_API_KEY) ?? "");
  }, []);

  const parsed = useMemo(() => parseCsv(csvText), [csvText]);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setCsvText(text);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult(null);

    const trimmedKey = apiKey.trim();
    if (!trimmedKey) {
      setResult({ ok: false, error: { code: "missing_api_key", message: "管理用APIキーを入力してください。" } });
      return;
    }
    if (parsed.rows.length === 0) {
      setResult({ ok: false, error: { code: "no_rows", message: "CSVに有効な行がありません。" } });
      return;
    }

    sessionStorage.setItem(SESSION_API_KEY, trimmedKey);
    setIsLoading(true);

    try {
      const response = await fetch(`/api/v1/organizations/${DEMO_ORGANIZATION_ID}/csv-import`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": trimmedKey },
        body: JSON.stringify({
          supplier,
          targetChannel,
          discoveredByUserId: DEMO_USER_ID,
          rows: parsed.rows
        })
      });
      const payload = (await response.json().catch(() => null)) as SaveResult | null;

      setResult(payload ?? { ok: false, error: { code: "no_payload", message: "応答が不正でした。" } });
    } catch (error) {
      setResult({
        ok: false,
        error: { code: "request_failed", message: error instanceof Error ? error.message : "リクエスト失敗" }
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="card rakuten-panel" aria-labelledby="supplier-import-title">
      <div className="section-kicker">Wholesale CSV</div>
      <div className="spread rakuten-panel-head">
        <div>
          <h2 id="supplier-import-title" className="panel-title">
            卸 / ドロップシッピング CSV 取り込み
          </h2>
          <p className="muted">
            NETSEA / TopSeller / CJdropshipping 等から CSV をダウンロードして取り込みます。
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
        </label>

        <label className="field">
          <span className="field-label">仕入れ先(supplier)</span>
          <select className="input" value={supplier} onChange={(event) => setSupplier(event.target.value as SupplierName)}>
            <option value="netsea">NETSEA</option>
            <option value="topseller">TopSeller</option>
            <option value="cj">CJdropshipping</option>
            <option value="other">その他</option>
          </select>
        </label>

        <label className="field">
          <span className="field-label">販売先 (target)</span>
          <select className="input" value={targetChannel} onChange={(event) => setTargetChannel(event.target.value)}>
            <option value="yahoo_shopping">Yahoo!ショッピング</option>
            <option value="amazon_jp">Amazon JP</option>
            <option value="mercari">メルカリ</option>
            <option value="yahoo_auction">Yahoo!オークション</option>
            <option value="store">自社/店舗</option>
          </select>
        </label>

        <label className="field field-wide">
          <span className="field-label">CSV ファイル(または下のテキストに貼り付け)</span>
          <input className="input" type="file" accept=".csv,text/csv,text/plain" onChange={handleFile} />
          <span className="field-help">
            UTF-8 推奨。1行目はヘッダ。認識する列: <code>{COLUMN_HINTS.join(", ")}</code>(必須: title, supplier_price)
          </span>
        </label>

        <label className="field field-wide">
          <span className="field-label">CSV 本文</span>
          <textarea
            className="input"
            value={csvText}
            onChange={(event) => setCsvText(event.target.value)}
            rows={8}
            placeholder={SAMPLE_CSV}
            style={{ minHeight: 160, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12 }}
          />
          <span className="field-help">
            検出ヘッダ: {parsed.headers.length > 0 ? parsed.headers.join(", ") : "(未入力)"} ・
            有効行: <strong>{parsed.rows.length}</strong> / 全行: {parsed.totalLines}
          </span>
        </label>

        <div className="rakuten-form-actions">
          <button className="button" type="submit" disabled={isLoading || parsed.rows.length === 0}>
            {isLoading ? "取り込み中..." : `${parsed.rows.length}件を取り込む`}
          </button>
          <button
            className="button secondary"
            type="button"
            onClick={() => {
              setCsvText(SAMPLE_CSV);
              setResult(null);
            }}
          >
            サンプルCSVを挿入
          </button>
          <button
            className="button secondary"
            type="button"
            onClick={() => {
              setCsvText("");
              setResult(null);
            }}
          >
            クリア
          </button>
        </div>
      </form>

      {parsed.rows.length > 0 ? (
        <div className="rakuten-results">
          <h3 className="result-title">プレビュー(先頭{Math.min(parsed.rows.length, MAX_PREVIEW_ROWS)}件)</h3>
          <div className="table-wrap rakuten-table">
            <table className="table">
              <thead>
                <tr>
                  <th>商品名</th>
                  <th className="num">仕入価格</th>
                  <th>JAN/SKU</th>
                  <th className="num">在庫</th>
                  <th>状態</th>
                </tr>
              </thead>
              <tbody>
                {parsed.rows.slice(0, MAX_PREVIEW_ROWS).map((row, index) => (
                  <tr key={index}>
                    <td className="cell-main">{row.title}</td>
                    <td className="num">
                      {row.supplier_price ? `${formatYen(Number(row.supplier_price))}` : "—"}
                    </td>
                    <td>{row.jan ?? row.sku ?? "—"}</td>
                    <td className="num">{row.stock_qty ?? "—"}</td>
                    <td>{row.condition ?? "new"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {result?.error ? (
        <div className="alert danger rakuten-alert" role="alert">
          <div>
            <div className="alert-title">取り込みに失敗しました</div>
            <div className="alert-body">{result.error.message}</div>
          </div>
        </div>
      ) : null}

      {result?.ok && result.data ? (
        <div className="rakuten-results">
          <div className="spread">
            <div>
              <h3 className="result-title">取り込み結果</h3>
              <p className="muted tiny">
                {result.data.supplier} → {result.data.targetChannel} / 受理 {result.data.acceptedRows}件・拒否{" "}
                {result.data.rejectedRows}件・保存 {result.data.savedCount}件
              </p>
            </div>
            <span className="badge good">DB保存済み</span>
          </div>

          {result.data.savedCount > 0 ? (
            <div className="alert info rakuten-cta" role="status">
              <Icon name="opportunity" />
              <div className="cta-text">
                <div className="alert-title">{result.data.savedCount}件を仕入れ候補として保存しました</div>
                <div className="alert-body">価格差チャンスで利益・ROI・判定を確認できます。</div>
              </div>
              <Link className="button" href="/opportunities">
                価格差チャンスを見る
              </Link>
            </div>
          ) : null}

          {result.data.rejectionReasons.length > 0 ? (
            <div className="alert warning rakuten-alert" role="status">
              <Icon name="warning" />
              <div>
                <div className="alert-title">{result.data.rejectedRows}件をスキップ</div>
                <div className="alert-body">
                  例:{" "}
                  {result.data.rejectionReasons
                    .slice(0, 3)
                    .map((r) => `#${r.index + 1} ${r.reason}`)
                    .join(" / ")}
                </div>
              </div>
            </div>
          ) : null}

          {result.data.savedItems.length > 0 ? (
            <div className="table-wrap rakuten-table">
              <table className="table">
                <thead>
                  <tr>
                    <th>商品</th>
                    <th className="num">仕入価格</th>
                    <th className="num">想定売価</th>
                    <th className="num">想定利益</th>
                    <th className="num">ROI</th>
                  </tr>
                </thead>
                <tbody>
                  {result.data.savedItems.slice(0, 10).map((item, index) => (
                    <tr key={index}>
                      <td className="cell-main">{item.title}</td>
                      <td className="num">{formatYen(item.supplierPrice)}</td>
                      <td className="num">{item.targetExpectedPrice == null ? "—" : formatYen(item.targetExpectedPrice)}</td>
                      <td className="num" style={{ color: profitColor(item.estimatedProfit) }}>
                        {item.estimatedProfit == null ? "—" : formatYen(item.estimatedProfit)}
                      </td>
                      <td className="num">{item.estimatedRoi == null ? "—" : `${(item.estimatedRoi * 100).toFixed(1)}%`}</td>
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

function parseCsv(text: string): { headers: string[]; rows: ParsedRow[]; totalLines: number } {
  if (!text.trim()) return { headers: [], rows: [], totalLines: 0 };

  const stripped = text.replace(/^﻿/, "");
  const lines: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < stripped.length; i += 1) {
    const char = stripped[i];

    if (inQuotes) {
      if (char === '"') {
        if (stripped[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === ",") {
      row.push(field);
      field = "";
      continue;
    }
    if (char === "\n" || char === "\r") {
      if (char === "\r" && stripped[i + 1] === "\n") i += 1;
      row.push(field);
      field = "";
      lines.push(row);
      row = [];
      continue;
    }
    field += char;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    lines.push(row);
  }

  if (lines.length === 0) return { headers: [], rows: [], totalLines: 0 };

  const headers = lines[0].map((header) => header.trim().toLowerCase());
  const dataLines = lines.slice(1).filter((line) => line.some((cell) => cell.trim() !== ""));
  const rows: ParsedRow[] = dataLines.map((line) => {
    const record: ParsedRow = {};
    for (let i = 0; i < headers.length; i += 1) {
      record[headers[i]] = (line[i] ?? "").trim();
    }
    return record;
  });

  return { headers, rows, totalLines: dataLines.length };
}

function formatYen(amount: number) {
  return `${amount.toLocaleString("ja-JP")}円`;
}

function profitColor(amount: number | null) {
  if (amount == null) return "var(--c-text-muted)";
  if (amount <= 0) return "var(--c-danger)";
  return "var(--c-success)";
}
