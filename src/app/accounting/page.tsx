import { AppShell } from "@/components/app-shell";
import { Icon } from "@/components/icons";
import { accountingRows } from "@/lib/mock-data";
import { yen } from "@/lib/format";

export default function AccountingPage() {
  return (
    <AppShell
      active="会計"
      title="会計CSV / レポート"
      subtitle="売上・原価・送料・手数料を集計し、会計ソフト向けに出力します。"
    >
      <section className="grid columns-4">
        {accountingRows.map((row) => {
          const isProfit = row.label.includes("粗利");
          return (
            <div className="card metric-card" key={row.label}>
              <p className="card-title">{row.label}</p>
              <p className="metric" style={isProfit ? { color: "var(--c-success)" } : undefined}>
                {yen(row.amount)}
              </p>
            </div>
          );
        })}
      </section>

      <div className="section-head">
        <div>
          <h2 className="section-title">CSV出力</h2>
          <p className="section-desc">対象期間の仕訳データを会計ソフト形式で書き出します。</p>
        </div>
      </div>
      <div className="toolbar">
        <button className="button" type="button">
          <Icon name="accounting" />
          freee CSV
        </button>
        <button className="button secondary" type="button">
          <Icon name="accounting" />
          MoneyForward CSV
        </button>
        <button className="button secondary" type="button">
          <Icon name="accounting" />
          汎用 CSV
        </button>
      </div>
    </AppShell>
  );
}
