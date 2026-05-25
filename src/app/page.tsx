import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Icon } from "@/components/icons";
import { yen, gradeClass, gradeMeaning } from "@/lib/format";
import { DEMO_ORGANIZATION_ID, listOpportunityRows, type OpportunityRow } from "@/lib/sales/opportunities";

export const dynamic = "force-dynamic";

export default async function Home() {
  const rows = await listOpportunityRows(DEMO_ORGANIZATION_ID);

  const total = rows.length;
  const gradeA = rows.filter((row) => row.judgement === "A").length;
  const gradeAB = rows.filter((row) => row.judgement === "A" || row.judgement === "B").length;
  const realCount = rows.filter((row) => row.priceBasis === "real").length;
  const profitable = rows.filter((row) => row.estimatedProfit != null && row.estimatedProfit > 0);
  const realProfitable = profitable.filter((row) => row.priceBasis === "real").length;
  const totalProfit = profitable.reduce((sum, row) => sum + (row.estimatedProfit ?? 0), 0);
  const topOpportunities = [...rows]
    .sort((a, b) => (b.estimatedProfit ?? Number.NEGATIVE_INFINITY) - (a.estimatedProfit ?? Number.NEGATIVE_INFINITY))
    .slice(0, 5);
  const pendingReal = total - realCount;

  const kpis = [
    { label: "価格差候補", value: String(total), icon: "opportunity" as const, foot: "アクティブな仕入れ候補" },
    { label: "仕入れ推奨(A)", value: String(gradeA), icon: "spark" as const, foot: `A/B 合計 ${gradeAB} 件` },
    {
      label: "想定利益(黒字候補計)",
      value: yen(totalProfit),
      icon: "yen" as const,
      foot: `黒字 ${profitable.length} 件・実売確定 ${realProfitable} 件`
    },
    { label: "実売カバレッジ", value: String(realCount), icon: "compare" as const, foot: `全${total}件中 / 推定 ${pendingReal} 件` }
  ];

  return (
    <AppShell
      active="ダッシュボード"
      title="ダッシュボード"
      subtitle="楽天(仕入れ)と Yahoo(実売)の横断比較から、今日見るべき利益候補を把握します。"
    >
      <div className="stack-3" style={{ marginBottom: "var(--sp-6)" }}>
        {pendingReal > 0 ? (
          <div className="alert warning">
            <Icon name="warning" />
            <div>
              <div className="alert-title">実売価格が未取得の候補が {pendingReal} 件あります</div>
              <div className="alert-body">
                推定(原価×倍率)のままでは判定が甘くなります。
                <Link href="/opportunities" style={{ fontWeight: 700, textDecoration: "underline" }}>
                  {" "}価格差チャンス
                </Link>
                の「実売価格を更新(Yahoo)」で実勢に合わせましょう。
              </div>
            </div>
          </div>
        ) : null}
        <div className="alert info">
          <Icon name="info" />
          <div>
            <div className="alert-title">Amazon 相場(Keepa)/ AI 判定は未接続です</div>
            <div className="alert-body">
              現在の実売は Yahoo!ショッピングのみです。Amazon を加えると判定精度が上がります。
              <Link href="/settings/api" style={{ fontWeight: 700, textDecoration: "underline" }}>
                {" "}API連携設定
              </Link>
              から接続できます。
            </div>
          </div>
        </div>
      </div>

      <section className="grid columns-4" aria-label="主要指標">
        {kpis.map((kpi) => (
          <div className="card metric-card" key={kpi.label}>
            <span className="metric-icon">
              <Icon name={kpi.icon} />
            </span>
            <p className="card-title">{kpi.label}</p>
            <p className="metric">{kpi.value}</p>
            <p className="metric-foot">{kpi.foot}</p>
          </div>
        ))}
      </section>

      <div className="section-head">
        <div>
          <h2 className="section-title">価格差チャンス(上位)</h2>
          <p className="section-desc">想定利益の大きい仕入れ候補です。</p>
        </div>
        <Link className="button secondary" href="/opportunities">
          すべて見る
        </Link>
      </div>

      {topOpportunities.length > 0 ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>商品</th>
                <th>仕入れ → 販売</th>
                <th className="num">想定利益</th>
                <th className="num">ROI</th>
                <th>判定</th>
              </tr>
            </thead>
            <tbody>
              {topOpportunities.map((item) => (
                <tr key={item.id}>
                  <td>
                    <Link className="cell-link" href={crossPlatformHref(item)}>
                      {item.product}
                    </Link>
                    <span className="cell-sub">{item.risk}</span>
                  </td>
                  <td>
                    {item.buyChannel} <span className="muted">→</span> {item.sellChannel}
                  </td>
                  <td className="num strong" style={{ color: profitColor(item.estimatedProfit) }}>
                    {item.estimatedProfit == null ? "未算出" : yen(item.estimatedProfit)}
                  </td>
                  <td className="num">{item.roi == null ? "未算出" : `${(item.roi * 100).toFixed(1)}%`}</td>
                  <td>
                    <span className={`grade ${gradeClass(item.judgement)}`} title={gradeMeaning[item.judgement]}>
                      {item.judgement}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty">
          <strong>仕入れ候補がまだありません</strong>
          <span>API設定画面の楽天商品検索で「DB保存」をONにして検索すると、候補が表示されます。</span>
        </div>
      )}
    </AppShell>
  );
}

function profitColor(amount: number | null) {
  if (amount == null) return "var(--c-text-muted)";
  if (amount <= 0) return "var(--c-danger)";

  return "var(--c-success)";
}

function crossPlatformHref(item: OpportunityRow) {
  return item.productId
    ? `/cross-platform?productId=${encodeURIComponent(item.productId)}`
    : `/cross-platform?product=${encodeURIComponent(item.product)}`;
}
