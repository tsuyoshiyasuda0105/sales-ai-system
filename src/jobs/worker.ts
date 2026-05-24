import { Worker } from "bullmq";
import { redisConnection, type TenantJobPayload } from "@/lib/jobs/queue";

const worker = new Worker<TenantJobPayload>(
  "sedori-ai",
  async (job) => {
    console.log("Running job", job.name, job.data.organizationId);
    // Dispatch real job handlers here.
  },
  {
    connection: redisConnection
  }
);

worker.on("failed", (job, error) => {
  console.error("Job failed", job?.id, error);
});
