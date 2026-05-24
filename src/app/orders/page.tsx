import { AppShell } from "@/components/app-shell";
import { orders } from "@/lib/mock-data";
import { yen } from "@/lib/format";

function statusBadge(status: string) {
  if (status.includes("入金") || status.includes("完了")) return "good";
  if (status.includes("待ち") || status.includes("返品")) return "watch";
  return "neutral";
}

export default function OrdersPage() {
  return (
    <AppShell
      active="注文"
      title="注文一覧"
      subtitle="販売・発送・返品・入金状況を確認します。"
    >
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>注文日</th>
              <th>販路</th>
              <th>商品</th>
              <th className="num">売上</th>
              <th className="num">手数料</th>
              <th>状態</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id}>
                <td className="num">{order.orderedAt}</td>
                <td>{order.channel}</td>
                <td className="cell-main">{order.product}</td>
                <td className="num">{yen(order.total)}</td>
                <td className="num">{yen(order.fee)}</td>
                <td>
                  <span className={`badge ${statusBadge(order.status)}`}>{order.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
