import { AppShell } from "@/components/app-shell";
import { pct } from "@/lib/format";

const usage = [
  { label: "Keepa取得", value: 320, limit: 1000, unit: "件 / 月" },
  { label: "AI判定", value: 86, limit: 500, unit: "件 / 月" }
];

export default function BillingPage() {
  return (
    <AppShell
      active="利用量/課金"
      title="利用量 / 課金"
      subtitle="Keepa・AI・API取得回数をテナント単位で管理します。"
    >
      <section className="grid columns-3">
        {usage.map((item) => {
          const ratio = item.value / item.limit;
          const grade = ratio >= 0.9 ? "grade-ng" : ratio >= 0.7 ? "grade-b" : "grade-a";
          return (
            <div className="card" key={item.label}>
              <p className="card-title">{item.label}</p>
              <div className="metric-row">
                <p className="metric">{item.value.toLocaleString("ja-JP")}</p>
                <span className="muted tiny">/ {item.limit.toLocaleString("ja-JP")}</span>
              </div>
              <div className={`scorebar ${grade}`}>
                <span style={{ width: `${Math.min(ratio * 100, 100)}%` }} />
              </div>
              <p className="metric-foot">
                {pct(ratio, 0)} 使用 · {item.unit}
              </p>
            </div>
          );
        })}

        <div className="card">
          <p className="card-title">プラン</p>
          <p className="metric">MVP</p>
          <p className="metric-foot">課金未接続(無料トライアル運用)</p>
        </div>
      </section>
    </AppShell>
  );
}
