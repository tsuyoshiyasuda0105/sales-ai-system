import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Icon } from "@/components/icons";
import { opportunities } from "@/lib/mock-data";
import { yen, pct, gradeClass, gradeMeaning } from "@/lib/format";

const kpis = [
  {
    label: "価格差候補",
    value: "128",
    icon: "opportunity" as const,
    foot: "過去7日",
    delta: "+12",
    dir: "up" as const
  },
  {
    label: "仕入れ推奨(A)",
    value: "11",
    icon: "spark" as const,
    foot: "A/B 合計 34 件"
  },
  {
    label: "想定利益(今月)",
    value: "186,200円",
    icon: "yen" as const,
    foot: "前月比",
    delta: "+8.4%",
    dir: "up" as const
  },
  {
    label: "在庫滞留",
    value: "7",
    icon: "warning" as const,
    foot: "45日超 1 件",
    delta: "要対応",
    dir: "down" as const
  }
];

export default function Home() {
  const topOpportunities = opportunities.slice(0, 5);

  return (
    <AppShell
      active="ダッシュボード"
      title="ダッシュボード"
      subtitle="楽天 / Yahoo / Keepa / 手動入力の横断比較から、今日見るべき利益候補を把握します。"
    >
      <div className="stack-3" style={{ marginBottom: "var(--sp-6)" }}>
        <div className="alert warning">
          <Icon name="warning" />
          <div>
            <div className="alert-title">在庫滞留アラート</div>
            <div className="alert-body">
              「限定ホビー C」が 45 日滞留中です。販売価格の見直しまたは別販路を検討してください。
            </div>
          </div>
        </div>
        <div className="alert info">
          <Icon name="info" />
          <div>
            <div className="alert-title">一部のデータは手動入力です</div>
            <div className="alert-body">
              Keepa / OpenAI が未接続のため、Amazon 相場と AI 判定は簡易表示です。
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
            <p className="metric-foot">
              {kpi.delta ? (
                <span className={`delta ${kpi.dir}`}>
                  {kpi.dir === "up" ? "▲" : "▼"} {kpi.delta}
                </span>
              ) : null}{" "}
              {kpi.foot}
            </p>
          </div>
        ))}
      </section>

      <div className="section-head">
        <div>
          <h2 className="section-title">価格差チャンス(上位)</h2>
          <p className="section-desc">利益額の大きい仕入れ候補です。</p>
        </div>
        <Link className="button secondary" href="/opportunities">
          すべて見る
        </Link>
      </div>

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
                  <Link
                    className="cell-link"
                    href={`/cross-platform?product=${encodeURIComponent(item.product)}`}
                  >
                    {item.product}
                  </Link>
                  <span className="cell-sub">{item.risk}</span>
                </td>
                <td>
                  {item.buyChannel} <span className="muted">→</span> {item.sellChannel}
                </td>
                <td className="num strong">{yen(item.estimatedProfit)}</td>
                <td className="num">{pct(item.roi)}</td>
                <td>
                  <span
                    className={`grade ${gradeClass(item.judgement)}`}
                    title={gradeMeaning[item.judgement]}
                  >
                    {item.judgement}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
