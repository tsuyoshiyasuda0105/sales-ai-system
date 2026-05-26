import { AppShell } from "@/components/app-shell";
import { yen } from "@/lib/format";
import { prisma } from "@/lib/db";
import { DEMO_ORGANIZATION_ID } from "@/lib/sales/opportunities";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  draft: "下書き",
  ordered: "発注済み",
  partially_received: "一部入庫",
  received: "入庫完了",
  cancelled: "キャンセル",
  closed: "クローズ"
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
  if (status === "received" || status === "closed") return "good";
  if (status === "ordered" || status === "partially_received") return "watch";
  if (status === "cancelled") return "risk";
  return "neutral";
}

export default async function PurchasesPage() {
  const orders = await prisma.purchase_orders.findMany({
    where: { organization_id: DEMO_ORGANIZATION_ID, deleted_at: null },
    orderBy: { created_at: "desc" },
    include: {
      purchase_order_items: { select: { title: true, quantity_ordered: true }, take: 5 }
    },
    take: 100
  });

  return (
    <AppShell active="仕入れ" title="仕入れ登録" subtitle="仕入れ予定・実績・状態を管理します。">
      {orders.length > 0 ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>日付</th>
                <th>注文番号</th>
                <th>仕入先</th>
                <th>商品</th>
                <th className="num">数量</th>
                <th className="num">金額</th>
                <th>状態</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const items = order.purchase_order_items;
                const qty = items.reduce((sum, item) => sum + (item.quantity_ordered ?? 0), 0);
                const firstTitle = items[0]?.title ?? "—";
                const more = items.length > 1 ? ` 他${items.length - 1}点` : "";
                const supplier = order.source_channel
                  ? CHANNEL_LABEL[String(order.source_channel)] ?? String(order.source_channel)
                  : "—";

                return (
                  <tr key={order.id}>
                    <td className="num">{formatDate(order.ordered_at ?? order.created_at)}</td>
                    <td>{order.order_number}</td>
                    <td>{supplier}</td>
                    <td className="cell-main">
                      {firstTitle}
                      {more}
                    </td>
                    <td className="num">{qty || "—"}</td>
                    <td className="num strong">{yen(Number(order.total_amount))}</td>
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
          <strong>仕入れがまだ登録されていません</strong>
          <span>価格差チャンスでA判定の候補を見つけ、仕入れを実行するとここに表示されます。</span>
        </div>
      )}
    </AppShell>
  );
}

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString("ja-JP", { year: "numeric", month: "numeric", day: "numeric" });
}
