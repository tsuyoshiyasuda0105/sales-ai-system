import { AppShell } from "@/components/app-shell";
import { Icon } from "@/components/icons";
import { prisma } from "@/lib/db";
import { DEMO_ORGANIZATION_ID } from "@/lib/sales/opportunities";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = { active: "稼働中", paused: "停止中", disabled: "無効" };

function jobBadge(status: string) {
  return status === "active" ? "good" : "neutral";
}

function lastRunOutcome(job: {
  last_success_at: Date | null;
  last_failed_at: Date | null;
  last_run_at: Date | null;
}) {
  if (!job.last_run_at) return { label: "未実行", badge: "neutral" as const };

  const lastSuccess = job.last_success_at?.getTime() ?? 0;
  const lastFail = job.last_failed_at?.getTime() ?? 0;

  return lastSuccess >= lastFail
    ? { label: "成功", badge: "good" as const }
    : { label: "失敗", badge: "risk" as const };
}

export default async function JobsPage() {
  const jobs = await prisma.jobs.findMany({
    where: { organization_id: DEMO_ORGANIZATION_ID, deleted_at: null },
    orderBy: { created_at: "desc" },
    take: 100
  });

  return (
    <AppShell
      active="ジョブ"
      title="ジョブ実行履歴"
      subtitle="バックグラウンドジョブの定義と直近実行を確認します。"
      actions={
        <button className="button secondary" type="button" disabled>
          <Icon name="jobs" />
          手動実行(未実装)
        </button>
      }
    >
      {jobs.length > 0 ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>ジョブ</th>
                <th>スケジュール</th>
                <th>状態</th>
                <th>直近実行</th>
                <th>結果</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => {
                const outcome = lastRunOutcome(job);

                return (
                  <tr key={job.id}>
                    <td className="cell-main">{job.name}</td>
                    <td>{scheduleLabel(job)}</td>
                    <td>
                      <span className={`badge ${jobBadge(String(job.status))}`}>
                        {STATUS_LABEL[String(job.status)] ?? String(job.status)}
                      </span>
                    </td>
                    <td>{job.last_run_at ? formatDateTime(job.last_run_at) : "—"}</td>
                    <td>
                      <span className={`badge ${outcome.badge}`}>{outcome.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty">
          <strong>ジョブがまだ登録されていません</strong>
          <span>定期取得や監視ジョブを登録すると、ここに表示されます。</span>
        </div>
      )}
    </AppShell>
  );
}

function scheduleLabel(job: {
  schedule_type: string;
  cron_expression: string | null;
  repeat_interval_seconds: number | null;
}) {
  if (job.schedule_type === "cron" && job.cron_expression) return `cron: ${job.cron_expression}`;
  if (job.schedule_type === "interval" && job.repeat_interval_seconds) {
    const seconds = job.repeat_interval_seconds;
    if (seconds % 3600 === 0) return `${seconds / 3600}時間ごと`;
    if (seconds % 60 === 0) return `${seconds / 60}分ごと`;
    return `${seconds}秒ごと`;
  }
  if (job.schedule_type === "manual") return "手動";

  return job.schedule_type;
}

function formatDateTime(date: Date) {
  return new Date(date).toLocaleString("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}
