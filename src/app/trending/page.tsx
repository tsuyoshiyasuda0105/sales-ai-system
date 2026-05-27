import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Icon } from "@/components/icons";
import { yen } from "@/lib/format";
import { DEMO_ORGANIZATION_ID } from "@/lib/sales/opportunities";
import {
  getPriceTrends,
  type PriceTrendChannel,
  type PriceTrendRow
} from "@/lib/sales/price-trends";

export const dynamic = "force-dynamic";

const DEFAULT_DAYS = 7;
const DAYS_OPTIONS = [3, 7, 14] as const;
const CHANNEL_OPTIONS: Array<{ value: PriceTrendChannel; label: string }> = [
  { value: "rakuten", label: "楽天" },
  { value: "yahoo_shopping", label: "Yahoo!ショッピング" }
];
const DIRECTION_OPTIONS: Array<{ value: "up" | "down"; label: string }> = [
  { value: "up", label: "上昇順" },
  { value: "down", label: "下落順" }
];

type SearchParams = {
  channel?: string;
  days?: string;
  direction?: string;
};

export default async function TrendingPage({
  searchParams
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const channel: PriceTrendChannel = params.channel === "yahoo_shopping" ? "yahoo_shopping" : "rakuten";
  const days = parseDays(params.days);
  const direction: "up" | "down" = params.direction === "down" ? "down" : "up";

  const result = await getPriceTrends({
    organizationId: DEMO_ORGANIZATION_ID,
    channel,
    days,
    // 5% 未満の微変動はノイズなので落とす。本気で trending と呼べるものだけ。
    minRateAbs: 0.05,
    limit: 200
  });

  const sortedRows = [...result.rows].sort((a, b) =>
    direction === "up" ? b.priceChangeRate - a.priceChangeRate : a.priceChangeRate - b.priceChangeRate
  );

  return (
    <AppShell
      active="トレンド"
      title="価格・人気トレンド"
      subtitle="直近の市場価格データを比較し、価格が大きく動いた / ランクが急上昇した商品を抽出します。"
    >
      <div className="toolbar" style={{ marginBottom: "var(--sp-3)" }}>
        <span className="muted tiny">販路:</span>
        {CHANNEL_OPTIONS.map((option) => (
          <Link
            key={option.value}
            className={`button ${option.value === channel ? "" : "secondary"}`}
            href={buildHref({ channel: option.value, days, direction })}
          >
            {option.label}
          </Link>
        ))}

        <span className="muted tiny" style={{ marginLeft: "var(--sp-4)" }}>
          期間:
        </span>
        {DAYS_OPTIONS.map((option) => (
          <Link
            key={option}
            className={`button ${option === days ? "" : "secondary"}`}
            href={buildHref({ channel, days: option, direction })}
          >
            {option}日
          </Link>
        ))}

        <span className="muted tiny" style={{ marginLeft: "var(--sp-4)" }}>
          並び順:
        </span>
        {DIRECTION_OPTIONS.map((option) => (
          <Link
            key={option.value}
            className={`button ${option.value === direction ? "" : "secondary"}`}
            href={buildHref({ channel, days, direction: option.value })}
          >
            {option.label}
          </Link>
        ))}
      </div>

      <div className="alert info" style={{ marginBottom: "var(--sp-4)" }}>
        <Icon name="info" />
        <div>
          <div className="alert-title">蓄積されたデータから価格変化を抽出しています</div>
          <div className="alert-body">
            毎日 Cron({channel === "rakuten" ? "楽天" : "Yahoo!ショッピング"})で取得した市場価格を、現在と{days}
            日前で比較しています。 ±5% 未満の微変動は除外。商品ページから候補登録を行うと
            <strong>利益・ROI 列も表示</strong>されます。
          </div>
        </div>
      </div>

      {sortedRows.length === 0 ? (
        <div className="empty">
          <strong>表示できる商品がまだありません</strong>
          <span>
            この販路で {days} 日以上前のスナップショットを持つ商品が見つかりません。Cron
            によるデータ蓄積が進むと表示されます。最初の {days} 日が経過するまで一覧は空のままになります。
          </span>
        </div>
      ) : (
        <TrendingTable rows={sortedRows} days={days} totalEvaluated={result.evaluated} channel={channel} />
      )}
    </AppShell>
  );
}

function TrendingTable({
  rows,
  days,
  totalEvaluated,
  channel
}: {
  rows: PriceTrendRow[];
  days: number;
  totalEvaluated: number;
  channel: PriceTrendChannel;
}) {
  return (
    <>
      <div className="muted tiny" style={{ marginBottom: "var(--sp-2)" }}>
        対象 {totalEvaluated} 件中、価格変化が大きい商品 {rows.length} 件を表示。
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>商品</th>
              <th className="num">現在価格</th>
              <th className="num">{days}日前</th>
              <th className="num">変化額</th>
              <th className="num">変化率</th>
              <th className="num">ランク</th>
              <th>在庫</th>
              <th className="num">想定利益</th>
              <th>判定</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.productId}:${row.channel}`}>
                <td>
                  <div className="row" style={{ gap: "var(--sp-2)", alignItems: "center" }}>
                    {row.productImageUrl ? (
                      <img className="product-db-thumb" src={row.productImageUrl} alt="" />
                    ) : null}
                    <div style={{ minWidth: 0 }}>
                      <span className="cell-main">{truncate(row.productTitle, 48)}</span>
                      <span className="cell-sub">
                        {channelLabel(row.channel)} ・ {formatDate(row.currentFetchedAt)}取得
                      </span>
                    </div>
                  </div>
                </td>
                <td className="num strong">{yen(row.currentPrice)}</td>
                <td className="num">{yen(row.basePrice)}</td>
                <td className="num" style={{ color: changeColor(row.priceChange) }}>
                  {formatSignedYen(row.priceChange)}
                </td>
                <td className="num strong" style={{ color: changeColor(row.priceChangeRate) }}>
                  {formatPct(row.priceChangeRate)}
                </td>
                <td className="num">
                  {row.rankChange == null ? (
                    <span className="muted tiny">—</span>
                  ) : (
                    <span style={{ color: changeColor(row.rankChange) }}>{formatRankChange(row.rankChange)}</span>
                  )}
                </td>
                <td>{stockBadge(row.inStock)}</td>
                <td className="num">
                  {row.estimatedProfit == null ? (
                    <span className="muted tiny">—</span>
                  ) : (
                    <span style={{ color: changeColor(row.estimatedProfit) }}>{yen(row.estimatedProfit)}</span>
                  )}
                </td>
                <td>{judgementBadge(row.judgement)}</td>
                <td className="num">
                  <Link className="button ghost" href={`/cross-platform?productId=${row.productId}`}>
                    横断比較
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="muted tiny" style={{ marginTop: "var(--sp-3)" }}>
        {channel === "rakuten"
          ? "※ ランクは楽天ランキングAPI由来。「ランク」のマイナスは順位が上がった(=人気上昇)を示します。"
          : "※ Yahoo!ショッピングはランク情報を持たないため、ランク列は常に空欄になります。"}
      </div>
    </>
  );
}

function buildHref({
  channel,
  days,
  direction
}: {
  channel: PriceTrendChannel;
  days: number;
  direction: "up" | "down";
}) {
  const params = new URLSearchParams({
    channel,
    days: String(days),
    direction
  });

  return `/trending?${params.toString()}`;
}

function parseDays(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) return DEFAULT_DAYS;
  if (DAYS_OPTIONS.includes(parsed as (typeof DAYS_OPTIONS)[number])) return parsed;

  return DEFAULT_DAYS;
}

function changeColor(value: number) {
  if (value > 0) return "var(--c-success)";
  if (value < 0) return "var(--c-danger)";

  return "var(--c-text-muted)";
}

function formatSignedYen(value: number) {
  if (value === 0) return yen(0);
  const sign = value > 0 ? "+" : "−";

  return `${sign}${yen(Math.abs(value))}`;
}

function formatPct(rate: number) {
  const pct = rate * 100;
  const sign = pct > 0 ? "+" : pct < 0 ? "−" : "";

  return `${sign}${Math.abs(pct).toFixed(1)}%`;
}

function formatRankChange(delta: number) {
  if (delta === 0) return "±0";
  const sign = delta > 0 ? "↑" : "↓";

  return `${sign}${Math.abs(delta)}`;
}

function stockBadge(inStock: boolean | null) {
  if (inStock == null) return <span className="badge neutral">不明</span>;

  return inStock ? <span className="badge good">あり</span> : <span className="badge risk">なし</span>;
}

function judgementBadge(judgement: PriceTrendRow["judgement"]) {
  if (judgement == null) return <span className="muted tiny">—</span>;

  const className =
    judgement === "A" ? "good" : judgement === "B" ? "info" : judgement === "C" ? "neutral" : "risk";

  return <span className={`badge ${className}`}>{judgement}</span>;
}

function channelLabel(channel: PriceTrendChannel) {
  return channel === "rakuten" ? "楽天" : "Yahoo!ショッピング";
}

function truncate(value: string, max: number) {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" });
}
