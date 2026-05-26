import { AppShell } from "@/components/app-shell";
import { yen } from "@/lib/format";
import { prisma } from "@/lib/db";
import { DEMO_ORGANIZATION_ID } from "@/lib/sales/opportunities";

export const dynamic = "force-dynamic";

export default async function AccountingPage() {
  const [salesAgg, purchasesAgg, feeAgg, entriesCount] = await Promise.all([
    prisma.orders.aggregate({
      where: { organization_id: DEMO_ORGANIZATION_ID, deleted_at: null },
      _sum: { total_amount: true }
    }),
    prisma.purchase_orders.aggregate({
      where: { organization_id: DEMO_ORGANIZATION_ID, deleted_at: null },
      _sum: { total_amount: true }
    }),
    prisma.fees.aggregate({
      where: { organization_id: DEMO_ORGANIZATION_ID },
      _sum: { amount: true }
    }),
    prisma.accounting_entries.count({
      where: { organization_id: DEMO_ORGANIZATION_ID, deleted_at: null }
    })
  ]);

  const sales = Number(salesAgg._sum.total_amount ?? 0);
  const purchases = Number(purchasesAgg._sum.total_amount ?? 0);
  const fees = Number(feeAgg._sum.amount ?? 0);
  const grossProfit = sales - purchases - fees;

  const cards = [
    { label: "売上(累計)", amount: sales, isProfit: false },
    { label: "仕入れ(累計)", amount: purchases, isProfit: false },
    { label: "手数料(累計)", amount: fees, isProfit: false },
    { label: "粗利(累計)", amount: grossProfit, isProfit: true }
  ];

  return (
    <AppShell
      active="会計"
      title="会計サマリー"
      subtitle="販売・仕入れ・手数料を集計します。会計ソフト出力は今後対応予定です。"
    >
      <section className="grid columns-4">
        {cards.map((row) => (
          <div className="card metric-card" key={row.label}>
            <p className="card-title">{row.label}</p>
            <p
              className="metric"
              style={
                row.isProfit
                  ? { color: row.amount >= 0 ? "var(--c-success)" : "var(--c-danger)" }
                  : undefined
              }
            >
              {yen(row.amount)}
            </p>
          </div>
        ))}
      </section>

      <div className="section-head">
        <div>
          <h2 className="section-title">仕訳ジャーナル</h2>
          <p className="section-desc">
            登録済みの会計仕訳: <strong>{entriesCount.toLocaleString("ja-JP")}</strong> 件
          </p>
        </div>
      </div>

      {entriesCount === 0 ? (
        <div className="empty">
          <strong>仕訳がまだ登録されていません</strong>
          <span>
            注文や仕入れが入ると、自動で会計仕訳が作成されます(将来対応)。CSV出力は仕訳が貯まってから提供します。
          </span>
        </div>
      ) : null}
    </AppShell>
  );
}
