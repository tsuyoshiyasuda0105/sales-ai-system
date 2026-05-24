import { ok } from "@/lib/api/response";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ organizationId: string }> }
) {
  const { organizationId } = await params;

  return ok({
    organizationId,
    jobs: [
      {
        id: "job_rakuten_sync",
        name: "楽天候補取得",
        schedule: "every 6 hours",
        status: "active",
        lastRunStatus: "succeeded"
      },
      {
        id: "job_keepa_watch",
        name: "Keepa監視更新",
        schedule: "daily",
        status: "active",
        lastRunStatus: "succeeded"
      }
    ]
  });
}
