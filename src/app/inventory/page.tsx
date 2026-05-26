import { AppShell } from "@/components/app-shell";
import { yen } from "@/lib/format";
import { prisma } from "@/lib/db";
import { DEMO_ORGANIZATION_ID } from "@/lib/sales/opportunities";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  candidate: "候補",
  ordered: "発注済み",
  received: "入庫",
  listed: "出品中",
  reserved: "確保",
  sold: "販売済",
  returned: "返品",
  dead_stock: "滞留",
  disposed: "廃棄"
};

function statusBadge(status: string) {
  if (status === "listed") return "good";
  if (status === "dead_stock" || status === "returned") return "risk";
  if (status === "sold") return "info";
  return "neutral";
}

function daysSince(date: Date | null) {
  if (!date) return null;
  return Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
}

export default async function InventoryPage() {
  const items = await prisma.inventory_items.findMany({
    where: { organization_id: DEMO_ORGANIZATION_ID, deleted_at: null },
    orderBy: { created_at: "desc" },
    include: { products: { select: { title: true } } },
    take: 100
  });

  return (
    <AppShell active="在庫" title="在庫一覧" subtitle="在庫状態・原価・販売価格・滞留日数を管理します。">
      {items.length > 0 ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>商品</th>
                <th>状態</th>
                <th className="num">原価</th>
                <th className="num">販売価格</th>
                <th className="num">在庫日数</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const days = daysSince(item.received_at ?? item.created_at);

                return (
                  <tr key={item.id}>
                    <td className="num">{item.inventory_sku}</td>
                    <td className="cell-main">{item.products?.title ?? "—"}</td>
                    <td>
                      <span className={`badge ${statusBadge(String(item.status))}`}>
                        {STATUS_LABEL[String(item.status)] ?? String(item.status)}
                      </span>
                    </td>
                    <td className="num">{yen(Number(item.acquisition_cost_amount))}</td>
                    <td className="num">
                      {item.listed_price_amount == null ? "—" : yen(Number(item.listed_price_amount))}
                    </td>
                    <td className="num">
                      {days == null ? "—" : days >= 30 ? <span className="badge risk">{days}日</span> : `${days}日`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty">
          <strong>在庫がまだありません</strong>
          <span>仕入れを登録し入庫が完了すると、ここに在庫が表示されます。</span>
        </div>
      )}
    </AppShell>
  );
}
