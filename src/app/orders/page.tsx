import { AppShell } from "@/components/app-shell";
import { yen } from "@/lib/format";
import { prisma } from "@/lib/db";
import { DEMO_ORGANIZATION_ID } from "@/lib/sales/opportunities";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  unknown: "—",
  ordered: "受注",
  paid: "入金",
  shipped: "発送済",
  delivered: "配達完了",
  cancelled: "キャンセル",
  returned: "返品"
};

const CHANNEL_LABEL: Record<string, string> = {
  amazon_jp: "Amazon JP",
  rakuten: "楽天",
  yahoo_shopping: "Yahoo!ショッピング",
  yahoo_auction: "Yahoo!オークション",
  mercari: "メルカリ",
  store: "店舗/自社"
};

function statusBadge(status: string) {
  if (status === "delivered" || status === "paid") return "good";
  if (status === "returned" || status === "cancelled") return "risk";
  if (status === "shipped" || status === "ordered") return "watch";
  return "neutral";
}

export default async function OrdersPage() {
  const orders = await prisma.orders.findMany({
    where: { organization_id: DEMO_ORGANIZATION_ID, deleted_at: null },
    orderBy: [{ ordered_at: "desc" }, { created_at: "desc" }],
    include: {
      order_items_order_items_order_idToorders: { select: { title: true }, take: 3 },
      fees_fees_order_idToorders: { select: { amount: true } }
    },
    take: 100
  });

  return (
    <AppShell active="注文" title="注文一覧" subtitle="販売・発送・返品・入金状況を確認します。">
      {orders.length > 0 ? (
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
              {orders.map((order) => {
                const items = order.order_items_order_items_order_idToorders;
                const title = items[0]?.title ?? "—";
                const more = items.length > 1 ? ` 他${items.length - 1}点` : "";
                const feeTotal = order.fees_fees_order_idToorders.reduce(
                  (sum, fee) => sum + Number(fee.amount),
                  0
                );

                return (
                  <tr key={order.id}>
                    <td className="num">{formatDate(order.ordered_at ?? order.created_at)}</td>
                    <td>{CHANNEL_LABEL[String(order.channel)] ?? String(order.channel)}</td>
                    <td className="cell-main">
                      {title}
                      {more}
                    </td>
                    <td className="num strong">{yen(Number(order.total_amount))}</td>
                    <td className="num">{yen(feeTotal)}</td>
                    <td>
                      <span className={`badge ${statusBadge(String(order.status))}`}>
                        {STATUS_LABEL[String(order.status)] ?? String(order.status)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty">
          <strong>注文がまだありません</strong>
          <span>販路と連携するか手動登録すると、ここに販売実績が表示されます。</span>
        </div>
      )}
    </AppShell>
  );
}

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString("ja-JP", { year: "numeric", month: "numeric", day: "numeric" });
}
