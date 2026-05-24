import { AppShell } from "@/components/app-shell";
import { Icon } from "@/components/icons";
import { auditLogs } from "@/lib/mock-data";

function severityBadge(severity: string) {
  if (severity === "warning") return "watch";
  if (severity === "error" || severity === "critical") return "risk";
  return "neutral";
}

export default function SecurityPage() {
  return (
    <AppShell
      active="監査ログ"
      title="監査ログ / セキュリティイベント"
      subtitle="APIキー操作・権限変更・不審ログイン・ジョブ実行を追跡します。"
      actions={
        <span className="search">
          <Icon name="search" />
          <input className="input" placeholder="操作・ユーザーで検索" />
        </span>
      }
    >
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>日時</th>
              <th>ユーザー</th>
              <th>操作</th>
              <th>重大度</th>
            </tr>
          </thead>
          <tbody>
            {auditLogs.map((log) => (
              <tr key={`${log.at}-${log.action}`}>
                <td className="num">{log.at}</td>
                <td>{log.user}</td>
                <td className="cell-main">{log.action}</td>
                <td>
                  <span className={`badge ${severityBadge(log.severity)}`}>{log.severity}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
