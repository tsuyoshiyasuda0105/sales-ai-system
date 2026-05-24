import { AppShell } from "@/components/app-shell";
import { Icon } from "@/components/icons";
import { jobs } from "@/lib/mock-data";

const statusLabel: Record<string, string> = { active: "稼働中", paused: "停止中" };

function runBadge(run: string) {
  if (run === "成功") return "good";
  if (run === "失敗") return "risk";
  return "neutral";
}

export default function JobsPage() {
  return (
    <AppShell
      active="ジョブ"
      title="ジョブ実行履歴"
      subtitle="API取得・Keepa監視・AI判定・会計レポートの実行状況を確認します。"
      actions={
        <button className="button secondary" type="button">
          <Icon name="jobs" />
          手動実行
        </button>
      }
    >
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>ジョブ</th>
              <th>間隔</th>
              <th>状態</th>
              <th>直近実行</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.name}>
                <td className="cell-main">{job.name}</td>
                <td>{job.schedule}</td>
                <td>
                  <span className={`badge ${job.status === "active" ? "good" : "neutral"}`}>
                    {statusLabel[job.status] ?? job.status}
                  </span>
                </td>
                <td>
                  <span className={`badge ${runBadge(job.lastRun)}`}>{job.lastRun}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
