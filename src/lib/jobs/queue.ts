import { Queue } from "bullmq";
import IORedis from "ioredis";
import { env } from "@/lib/env";

export type JobName =
  | "sync-rakuten-candidates"
  | "sync-yahoo-candidates"
  | "fetch-keepa-product"
  | "score-sourcing-candidate"
  | "sync-amazon-orders"
  | "generate-accounting-export";

export type TenantJobPayload = {
  organizationId: string;
  requestedByUserId?: string;
  params?: Record<string, unknown>;
};

export const redisConnection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null
});

export const jobQueue = new Queue<TenantJobPayload>("sedori-ai", {
  connection: redisConnection
});
