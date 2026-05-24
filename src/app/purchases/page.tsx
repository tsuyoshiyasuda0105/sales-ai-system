import { AppShell } from "@/components/app-shell";
import { Icon } from "@/components/icons";
import { purchases } from "@/lib/mock-data";
import { yen } from "@/lib/format";

function statusBadge(status: string) {
  if (status.includes("待ち")) return "watch";
  if (status.includes("完了") || status.includes("入庫")) return "good";
  return "neutral";
}

export default function PurchasesPage() {
  return (
    <AppShell
      active="仕入れ"
      title="仕入れ登録"
      subtitle="仕入れ予定・実績・証憑・古物台帳情報を管理します。"
      actions={
        <>
          <button className="button secondary" type="button">
            <Icon name="accounting" />
            CSV取込
          </button>
          <button className="button" type="button">
            <Icon name="purchase" />
            仕入れ登録
          </button>
        </>
      }
    >
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>日付</th>
              <th>仕入先</th>
              <th>商品</th>
              <th className="num">数量</th>
              <th className="num">金額</th>
              <th>状態</th>
            </tr>
          </thead>
          <tbody>
            {purchases.map((item) => (
              <tr key={item.id}>
                <td className="num">{item.date}</td>
                <td>{item.supplier}</td>
                <td className="cell-main">{item.product}</td>
                <td className="num">{item.quantity}</td>
                <td className="num strong">{yen(item.amount)}</td>
                <td>
                  <span className={`badge ${statusBadge(item.status)}`}>{item.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
