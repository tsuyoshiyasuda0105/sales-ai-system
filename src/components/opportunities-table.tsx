"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import { gradeClass } from "@/lib/format";
import type { OpportunityRow } from "@/lib/sales/opportunities";

const DEMO_ORGANIZATION_ID = "00000000-0000-4000-8000-000000000101";
const SESSION_API_KEY = "sales-ai-admin-api-key";

type RefreshState = {
  loading: boolean;
  message?: string;
  error?: boolean;
};

type JudgementFilter = "all" | "A" | "B" | "C" | "NG";
type SortKey = "buyPrice" | "expected" | "profit" | "roi" | "popularity";
type SortDir = "asc" | "desc";

const POPULAR_THRESHOLD = 50;

type EffectiveRow = OpportunityRow & {
  extraSavings: number;
  effNetCost: number;
  effProfit: number | null;
  effRoi: number | null;
  effBreakEven: number | null;
  effJudgement: "A" | "B" | "C" | "NG";
};

const JUDGEMENTS: { key: JudgementFilter; label: string }[] = [
  { key: "all", label: "すべて" },
  { key: "A", label: "A" },
  { key: "B", label: "B" },
  { key: "C", label: "C" },
  { key: "NG", label: "NG" }
];

const JUDGEMENT_TITLES: Record<string, string> = {
  A: "仕入れ推奨",
  B: "条件確認",
  C: "要検討",
  NG: "仕入れ非推奨"
};

export function OpportunitiesTable({
  rows,
  initialQuery = ""
}: {
  rows: OpportunityRow[];
  initialQuery?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [judgement, setJudgement] = useState<JudgementFilter>("all");
  const [profitableOnly, setProfitableOnly] = useState(false);
  const [realOnly, setRealOnly] = useState(false);
  const [popularOnly, setPopularOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [refreshState, setRefreshState] = useState<RefreshState>({ loading: false });
  const [pointRate, setPointRate] = useState(0);
  const [couponRate, setCouponRate] = useState(0);

  async function refreshRealPrices() {
    const apiKey = (typeof window !== "undefined" && sessionStorage.getItem(SESSION_API_KEY)) || "";

    if (!apiKey) {
      setRefreshState({
        loading: false,
        error: true,
        message: "管理用APIキーが未設定です。API設定画面で入力してから実行してください。"
      });
      return;
    }

    setRefreshState({ loading: true, message: "Yahoo!ショッピングの実売価格を取得中..." });

    try {
      const response = await fetch(`/api/v1/organizations/${DEMO_ORGANIZATION_ID}/yahoo/refresh-prices`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": apiKey },
        body: JSON.stringify({ limit: 8 })
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            ok: boolean;
            data?: { processed: number; updated: number; noMatch: number; rateLimited?: boolean };
            error?: { message: string };
          }
        | null;

      if (!response.ok || !payload?.ok || !payload.data) {
        setRefreshState({
          loading: false,
          error: true,
          message: payload?.error?.message ?? "実売価格の取得に失敗しました。"
        });
        return;
      }

      const { processed, updated, noMatch, rateLimited } = payload.data;
      const base = `${processed}件を照合 / 実売を反映 ${updated}件 / 該当なし ${noMatch}件`;
      setRefreshState({
        loading: false,
        error: rateLimited,
        message: rateLimited ? `${base}（Yahoo API上限に達したため中断。時間をおいて再実行してください）` : base
      });
      router.refresh();
    } catch (error) {
      setRefreshState({
        loading: false,
        error: true,
        message: error instanceof Error ? error.message : "実売価格の取得に失敗しました。"
      });
    }
  }

  const simActive = pointRate > 0 || couponRate > 0;

  const computed = useMemo<EffectiveRow[]>(() => {
    const rate = (pointRate + couponRate) / 100;

    return rows.map((row) => {
      const baseNetCost = row.buyPrice + row.buyShipping - row.pointValue;
      const extraSavings = Math.round(row.buyPrice * rate);
      const effNetCost = Math.max(1, baseNetCost - extraSavings);
      const effProfit = row.estimatedProfit == null ? null : row.estimatedProfit + extraSavings;
      const effRoi = effProfit == null ? null : effProfit / effNetCost;
      const effBreakEven = row.breakEvenPrice == null ? null : Math.max(0, row.breakEvenPrice - extraSavings);
      const effJudgement = simActive ? judgementFromMetrics(effProfit, effRoi) : row.judgement;

      return { ...row, extraSavings, effNetCost, effProfit, effRoi, effBreakEven, effJudgement };
    });
  }, [rows, pointRate, couponRate, simActive]);

  // counts are computed over the rows that pass *every other filter* (search, profitableOnly,
  // realOnly, popularOnly) so each judgement chip shows the realistic remaining count if the
  // user were to pick that judgement, not the raw whole-table A/B/C/NG distribution.
  const counts = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filteredForCounts = computed.filter((row) => {
      if (profitableOnly && !(row.effProfit != null && row.effProfit > 0)) return false;
      if (realOnly && row.priceBasis !== "real") return false;
      if (popularOnly && (row.reviewCount == null || row.reviewCount < POPULAR_THRESHOLD)) return false;
      if (q) {
        const haystack = `${row.product} ${row.buyChannel} ${row.sellChannel} ${row.risk}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    const base: Record<JudgementFilter, number> = {
      all: filteredForCounts.length,
      A: 0,
      B: 0,
      C: 0,
      NG: 0
    };
    for (const row of filteredForCounts) base[row.effJudgement] += 1;

    return base;
  }, [computed, query, profitableOnly, realOnly, popularOnly]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const next = computed.filter((row) => {
      if (judgement !== "all" && row.effJudgement !== judgement) return false;
      if (profitableOnly && !(row.effProfit != null && row.effProfit > 0)) return false;
      if (realOnly && row.priceBasis !== "real") return false;
      if (popularOnly && (row.reviewCount == null || row.reviewCount < POPULAR_THRESHOLD)) return false;
      if (q) {
        const haystack = `${row.product} ${row.buyChannel} ${row.sellChannel} ${row.risk}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });

    if (!sortKey) return next;

    const pick = (row: EffectiveRow): number | null => {
      switch (sortKey) {
        case "buyPrice":
          return row.buyPrice;
        case "expected":
          return row.expectedSellPrice;
        case "profit":
          return row.effProfit;
        case "roi":
          return row.effRoi;
        case "popularity":
          return row.reviewCount;
      }
    };

    return [...next].sort((a, b) => {
      const av = pick(a);
      const bv = pick(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;

      return sortDir === "asc" ? av - bv : bv - av;
    });
  }, [computed, query, judgement, profitableOnly, realOnly, popularOnly, sortKey, sortDir]);

  const realCount = useMemo(() => computed.filter((row) => row.priceBasis === "real").length, [computed]);
  const popularCount = useMemo(
    () => computed.filter((row) => row.reviewCount != null && row.reviewCount >= POPULAR_THRESHOLD).length,
    [computed]
  );

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDir("desc");
  }

  function exportCsv() {
    const header = [
      "判定",
      "商品",
      "仕入れチャネル",
      "販売チャネル",
      "販売基準",
      "仕入れ価格",
      "送料",
      "ポイント相当",
      "追加還元",
      "実質原価",
      "販売想定",
      "下限",
      "上限",
      "出品数",
      "損益分岐",
      "想定利益",
      "ROI",
      "評価",
      "レビュー数",
      "状態",
      "リスク",
      "仕入れ元URL"
    ];

    const lines = filtered.map((row) => [
      row.effJudgement,
      row.product,
      row.buyChannel,
      row.sellChannel,
      row.priceBasis === "real" ? "実売(Yahoo)" : "推定",
      row.buyPrice,
      row.buyShipping,
      row.pointValue,
      row.extraSavings,
      row.effNetCost,
      row.expectedSellPrice ?? "",
      row.expectedSellPriceLower ?? "",
      row.expectedSellPriceUpper ?? "",
      row.sellListingCount ?? "",
      row.effBreakEven ?? "",
      row.effProfit ?? "",
      row.effRoi == null ? "" : `${(row.effRoi * 100).toFixed(1)}%`,
      row.reviewRating == null ? "" : row.reviewRating.toFixed(1),
      row.reviewCount ?? "",
      row.status,
      row.risk,
      row.sourceUrl ?? ""
    ]);

    const csv = [header, ...lines].map((cols) => cols.map(csvCell).join(",")).join("\r\n");
    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `opportunities_${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (rows.length === 0) {
    return (
      <div className="empty">
        <strong>価格差チャンスはまだありません</strong>
        <span>API設定画面の楽天商品検索で「DB保存」をONにして検索すると、ここに候補が表示されます。</span>
      </div>
    );
  }

  return (
    <>
      <div className="toolbar">
        <span className="search">
          <Icon name="search" />
          <input
            className="input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="商品名・チャネル・リスクで絞り込み"
          />
        </span>

        <div className="filter-group" role="group" aria-label="判定で絞り込み">
          {JUDGEMENTS.map((option) => (
            <button
              key={option.key}
              type="button"
              className={`button secondary filter-chip ${judgement === option.key ? "is-active" : ""}`}
              aria-pressed={judgement === option.key}
              onClick={() => setJudgement(option.key)}
            >
              {option.label}
              <span className="filter-count">{counts[option.key]}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          className={`button secondary filter-chip ${profitableOnly ? "is-active" : ""}`}
          aria-pressed={profitableOnly}
          onClick={() => setProfitableOnly((value) => !value)}
          title={
            simActive
              ? "シミュレーション値で判定中。本来の利益(還元前)では赤字でも、ここでは黒字として残ります"
              : "現在の利益(シミュレーションOFF時)で判定"
          }
        >
          黒字のみ
        </button>

        <button
          type="button"
          className={`button secondary filter-chip ${realOnly ? "is-active" : ""}`}
          aria-pressed={realOnly}
          onClick={() => setRealOnly((value) => !value)}
        >
          実売のみ
          <span className="filter-count">{realCount}</span>
        </button>

        <button
          type="button"
          className={`button secondary filter-chip ${popularOnly ? "is-active" : ""}`}
          aria-pressed={popularOnly}
          onClick={() => setPopularOnly((value) => !value)}
          title={`楽天レビュー ${POPULAR_THRESHOLD} 件以上の候補のみ`}
        >
          人気のみ
          <span className="filter-count">{popularCount}</span>
        </button>

        <span className="spacer" />
        <span className="muted tiny">
          {filtered.length} / {rows.length} 件
        </span>
        <button className="button" type="button" onClick={refreshRealPrices} disabled={refreshState.loading}>
          <Icon name="spark" />
          {refreshState.loading ? "取得中..." : "実売価格を更新(Yahoo)"}
        </button>
        <button className="button secondary" type="button" onClick={exportCsv} disabled={filtered.length === 0}>
          <Icon name="accounting" />
          CSV出力
        </button>
      </div>
      {refreshState.message ? (
        <div className={`alert ${refreshState.error ? "danger" : "info"} refresh-status`} role="status">
          <Icon name={refreshState.error ? "warning" : "info"} />
          <div className="alert-body">{refreshState.message}</div>
        </div>
      ) : null}

      <div className={`sim-bar ${simActive ? "is-active" : ""}`}>
        <Icon name="yen" />
        <span className="sim-title">実質還元シミュレーション</span>
        <label className="sim-field">
          ポイント還元
          <input
            className="sim-input"
            type="number"
            min={0}
            max={50}
            value={pointRate}
            onChange={(event) => setPointRate(clampRate(event.target.value))}
          />
          <span className="sim-unit">%</span>
        </label>
        <label className="sim-field">
          クーポン
          <input
            className="sim-input"
            type="number"
            min={0}
            max={50}
            value={couponRate}
            onChange={(event) => setCouponRate(clampRate(event.target.value))}
          />
          <span className="sim-unit">%</span>
        </label>
        {simActive ? (
          <button
            className="button ghost"
            type="button"
            onClick={() => {
              setPointRate(0);
              setCouponRate(0);
            }}
          >
            リセット
          </button>
        ) : null}
        <span className="sim-note">
          {simActive
            ? pointRate + couponRate >= 60
              ? "⚠ 還元合計が高すぎます。実質原価が極端に下がり、ROI/判定が虚像になる可能性。現実的には合計40〜50%が上限です"
              : "楽天の実質還元を原価に反映して利益・ROI・判定を再計算中(表示のみ・DBは変更しません)"
            : "楽天のSPU/キャンペーン/クーポンの実質還元率を入れると、黒字になる商品が見えます"}
        </span>
      </div>

      {filtered.length > 0 ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>判定</th>
                <th>商品</th>
                <th>仕入れ → 販売</th>
                <SortHeader label="仕入れ価格" col="buyPrice" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortHeader label="販売想定" col="expected" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortHeader label="利益" col="profit" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortHeader label="ROI" col="roi" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortHeader label="人気度" col="popularity" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <th>状態</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id}>
                  <td>
                    <span
                      className={`grade ${gradeClass(item.effJudgement)}`}
                      title={JUDGEMENT_TITLES[item.effJudgement] ?? item.effJudgement}
                    >
                      {item.effJudgement}
                    </span>
                    {item.priceBasis !== "real" ? (
                      <span
                        className="cell-sub"
                        style={{ display: "block", marginTop: 2 }}
                        title="販売想定価格が推定値のため、判定も暫定です。実売価格を更新するか他販路を確認してください。"
                      >
                        (推定)
                      </span>
                    ) : null}
                  </td>
                  <td>
                    <Link className="cell-link" href={crossPlatformHref(item)}>
                      {item.product}
                    </Link>
                    <span className="cell-sub">
                      <Icon name="warning" style={{ width: 12, height: 12, verticalAlign: "-2px" }} /> {item.risk}
                    </span>
                    {item.variantCount && item.variantCount > 1 ? (
                      <span className="cell-sub muted">同型番 他 {item.variantCount - 1} 件(代表として表示)</span>
                    ) : null}
                  </td>
                  <td>
                    {item.buyChannel} <span className="muted">→</span> {item.sellChannel}
                    {item.sellChannel === "Amazon JP" ? (
                      <span className="cell-sub">
                        <a
                          className="sell-link"
                          href={amazonSearchUrl(item.product)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Amazon で出品を確認 ↗
                        </a>
                      </span>
                    ) : null}
                  </td>
                  <td className="num">
                    {formatYen(item.buyPrice)}
                    {item.buyShipping || item.pointValue ? (
                      <span className="cell-sub">
                        送料 {formatYen(item.buyShipping)} / ポイント {formatYen(item.pointValue)}
                      </span>
                    ) : null}
                    {simActive ? (
                      <span className="cell-sub sim-cost">
                        実質 {formatYen(item.effNetCost)}（還元 −{formatYen(item.extraSavings)}）
                      </span>
                    ) : null}
                  </td>
                  <td className="num">
                    <span className="sell-price-line">
                      {formatNullableYen(item.expectedSellPrice)}
                      <span className={`price-basis ${item.priceBasis === "real" ? "real" : "estimate"}`}>
                        {item.priceBasis === "real" ? "実売Yahoo" : "推定"}
                      </span>
                    </span>
                    {item.priceBasis === "real" ? (
                      <span className="cell-sub">
                        出品{item.sellListingCount ?? 0}件 {formatNullableYen(item.expectedSellPriceLower)}〜
                        {formatNullableYen(item.expectedSellPriceUpper)}
                        {item.sellUrl ? (
                          <>
                            {" · "}
                            <a className="sell-link" href={item.sellUrl} target="_blank" rel="noreferrer">
                              最安を見る
                            </a>
                          </>
                        ) : null}
                      </span>
                    ) : (
                      <span className="cell-sub">
                        下限 {formatNullableYen(item.expectedSellPriceLower)} / 上限{" "}
                        {formatNullableYen(item.expectedSellPriceUpper)}
                      </span>
                    )}
                    <span className="cell-sub">損益分岐 {formatNullableYen(item.effBreakEven)}</span>
                  </td>
                  <td className="num strong" style={{ color: profitColor(item.effProfit) }}>
                    {formatNullableYen(item.effProfit)}
                  </td>
                  <td className="num">{formatNullablePct(item.effRoi)}</td>
                  <td className="num">
                    {item.reviewCount == null ? (
                      "—"
                    ) : (
                      <>
                        {item.reviewRating != null ? (
                          <span className="strong">★{item.reviewRating.toFixed(1)}</span>
                        ) : null}
                        <span className="cell-sub">{item.reviewCount.toLocaleString("ja-JP")} レビュー</span>
                      </>
                    )}
                  </td>
                  <td>
                    <span className="badge neutral">{item.status}</span>
                  </td>
                  <td className="num">
                    {item.sourceUrl ? (
                      <a className="button ghost" href={item.sourceUrl} target="_blank" rel="noreferrer">
                        仕入れ元
                      </a>
                    ) : (
                      <Link className="button ghost" href={crossPlatformHref(item)}>
                        詳細
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty">
          <strong>条件に一致する候補がありません</strong>
          <span>検索ワードや判定フィルタ、「黒字のみ」を見直してください。</span>
        </div>
      )}
    </>
  );
}

function SortHeader({
  label,
  col,
  sortKey,
  sortDir,
  onSort
}: {
  label: string;
  col: SortKey;
  sortKey: SortKey | null;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
}) {
  const active = sortKey === col;

  return (
    <th className="num">
      <button
        type="button"
        className={`th-sort ${active ? "is-active" : ""}`}
        onClick={() => onSort(col)}
        aria-label={`${label}で並べ替え`}
      >
        {label}
        <span className="th-sort-ind" aria-hidden>
          {active ? (sortDir === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    </th>
  );
}

function formatYen(amount: number) {
  return `${amount.toLocaleString("ja-JP")}円`;
}

function formatNullableYen(amount: number | null) {
  return amount == null ? "未算出" : formatYen(amount);
}

function formatNullablePct(ratio: number | null) {
  return ratio == null ? "未算出" : `${(ratio * 100).toFixed(1)}%`;
}

function profitColor(amount: number | null) {
  if (amount == null) return "var(--c-text-muted)";
  if (amount <= 0) return "var(--c-danger)";

  return "var(--c-success)";
}

function judgementFromMetrics(profit: number | null, roi: number | null): "A" | "B" | "C" | "NG" {
  if (profit == null || roi == null) return "C";
  if (profit <= 0 || roi <= 0) return "NG";
  if (profit >= 2000 && roi >= 0.2) return "A";
  if (profit >= 800 && roi >= 0.1) return "B";

  return "C";
}

function clampRate(value: string) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return 0;

  return Math.min(50, Math.max(0, parsed));
}

function crossPlatformHref(item: { productId: string | null; product: string }) {
  return item.productId
    ? `/cross-platform?productId=${encodeURIComponent(item.productId)}`
    : `/cross-platform?product=${encodeURIComponent(item.product)}`;
}

function amazonSearchUrl(title: string) {
  return `https://www.amazon.co.jp/s?k=${encodeURIComponent(title)}`;
}

function csvCell(value: string | number) {
  const text = String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}
