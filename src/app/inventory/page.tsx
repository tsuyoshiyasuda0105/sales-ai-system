import { AppShell } from "@/components/app-shell";
import { inventory } from "@/lib/mock-data";
import { yen } from "@/lib/format";

function statusBadge(status: string) {
  if (status === "滞留注意") return "risk";
  if (status === "出品中") return "good";
  return "neutral";
}

export default function InventoryPage() {
  return (
    <AppShell
      active="在庫"
      title="在庫一覧"
      subtitle="在庫状態・原価・販売価格・滞留日数を管理します。"
    >
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
            {inventory.map((item) => (
              <tr key={item.sku}>
                <td className="num">{item.sku}</td>
                <td className="cell-main">{item.product}</td>
                <td>
                  <span className={`badge ${statusBadge(item.status)}`}>{item.status}</span>
                </td>
                <td className="num">{yen(item.cost)}</td>
                <td className="num">{yen(item.listedPrice)}</td>
                <td className="num">
                  {item.daysInStock >= 30 ? (
                    <span className="badge risk">{item.daysInStock}日</span>
                  ) : (
                    `${item.daysInStock}日`
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
