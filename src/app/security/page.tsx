import { AppShell } from "@/components/app-shell";
import { Icon } from "@/components/icons";
import { prisma } from "@/lib/db";
import { DEMO_ORGANIZATION_ID } from "@/lib/sales/opportunities";

export const dynamic = "force-dynamic";

export default async function SecurityPage() {
  const logs = await prisma.audit_logs.findMany({
    where: { organization_id: DEMO_ORGANIZATION_ID },
    orderBy: { created_at: "desc" },
    take: 200
  });

  return (
    <AppShell
      active="監査ログ"
      title="監査ログ / セキュリティイベント"
      subtitle="APIキー操作・権限変更・ジョブ実行などのイベントを追跡します。"
      actions={
        <span className="search">
          <Icon name="search" />
          <input className="input" placeholder="操作・ユーザーで検索(未実装)" disabled />
        </span>
      }
    >
      {logs.length > 0 ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>日時</th>
                <th>操作</th>
                <th>リソース</th>
                <th>概要</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="num">{formatDateTime(log.created_at)}</td>
                  <td className="cell-main">{String(log.action)}</td>
                  <td>{log.resource_type}</td>
                  <td>{log.summary ?? "—"}</td>
                  <td className="num">{log.ip_address ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty">
          <strong>監査ログがまだありません</strong>
          <span>権限・APIキー・ジョブ操作などが発生すると、ここに記録されます。</span>
        </div>
      )}
    </AppShell>
  );
}

function formatDateTime(date: Date) {
  return new Date(date).toLocaleString("ja-JP", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}
