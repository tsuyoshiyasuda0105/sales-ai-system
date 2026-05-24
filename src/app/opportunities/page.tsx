import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Icon } from "@/components/icons";
import { gradeClass } from "@/lib/format";
import { DEMO_ORGANIZATION_ID, listOpportunityRows } from "@/lib/sales/opportunities";

export const dynamic = "force-dynamic";

export default async function OpportunitiesPage() {
  const opportunities = await listOpportunityRows(DEMO_ORGANIZATION_ID);

  return (
    <AppShell
      active="価格差チャンス"
      title="価格差チャンス一覧"
      subtitle="DBに保存された仕入れ候補を、利益・ROI・リスクで確認します。楽天検索で保存した商品もここに表示されます。"
      actions={
        <button className="button secondary" type="button">
          <Icon name="accounting" />
          CSV出力
        </button>
      }
    >
      <div className="toolbar">
        <span className="search">
          <Icon name="search" />
          <input className="input" defaultValue="" placeholder="商品名・JAN・ASINで検索" />
        </span>
        <button className="button secondary" type="button">
          判定 すべて
        </button>
        <button className="button secondary" type="button">
          リスクあり
        </button>
        <span className="spacer" />
        <span className="muted tiny">{opportunities.length} 件</span>
      </div>

      {opportunities.length > 0 ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>判定</th>
                <th>商品</th>
                <th>仕入れ → 販売</th>
                <th className="num">仕入れ価格</th>
                <th className="num">販売想定</th>
                <th className="num">利益</th>
                <th className="num">ROI</th>
                <th>状態</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {opportunities.map((item) => (
                <tr key={item.id}>
                  <td>
                    <span className={`grade ${gradeClass(item.judgement)}`} title={judgementTitle(item.judgement)}>
                      {item.judgement}
                    </span>
                  </td>
                  <td>
                    <Link className="cell-link" href={`/cross-platform?product=${encodeURIComponent(item.product)}`}>
                      {item.product}
                    </Link>
                    <span className="cell-sub">
                      <Icon name="warning" style={{ width: 12, height: 12, verticalAlign: "-2px" }} /> {item.risk}
                    </span>
                  </td>
                  <td>
                    {item.buyChannel} <span className="muted">→</span> {item.sellChannel}
                  </td>
                  <td className="num">
                    {formatYen(item.buyPrice)}
                    {item.buyShipping || item.pointValue ? (
                      <span className="cell-sub">
                        送料 {formatYen(item.buyShipping)} / ポイント {formatYen(item.pointValue)}
                      </span>
                    ) : null}
                  </td>
                  <td className="num">{formatNullableYen(item.expectedSellPrice)}</td>
                  <td className="num strong" style={{ color: profitColor(item.estimatedProfit) }}>
                    {formatNullableYen(item.estimatedProfit)}
                  </td>
                  <td className="num">{formatNullablePct(item.roi)}</td>
                  <td>
                    <span className="badge neutral">{item.status}</span>
                  </td>
                  <td className="num">
                    {item.sourceUrl ? (
                      <a className="button ghost" href={item.sourceUrl} target="_blank" rel="noreferrer">
                        仕入れ元
                      </a>
                    ) : (
                      <button className="button ghost" type="button">
                        詳細
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty">
          <strong>価格差チャンスはまだありません</strong>
          <span>API設定画面の楽天商品検索で「DB保存」をONにして検索すると、ここに候補が表示されます。</span>
        </div>
      )}
    </AppShell>
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

function judgementTitle(judgement: string) {
  const labels: Record<string, string> = {
    A: "仕入れ推奨",
    B: "条件確認",
    C: "要検討",
    NG: "仕入れ非推奨"
  };

  return labels[judgement] ?? judgement;
}

function profitColor(amount: number | null) {
  if (amount == null) return "var(--c-text-muted)";
  if (amount <= 0) return "var(--c-danger)";

  return "var(--c-success)";
}
