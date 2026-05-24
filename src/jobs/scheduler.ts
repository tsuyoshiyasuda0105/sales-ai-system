import { jobQueue } from "@/lib/jobs/queue";

async function main() {
  console.log("Scheduler placeholder started");
  // Load enabled jobs from the jobs table and enqueue BullMQ repeatable jobs.
  await jobQueue.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
