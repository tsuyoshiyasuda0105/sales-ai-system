import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().optional(),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SALES_API_KEY: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  SITE_USERNAME: z.string().optional(),
  SITE_PASSWORD: z.string().optional(),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  OPENAI_API_KEY: z.string().optional(),
  ENCRYPTION_PROVIDER: z
    .enum(["local_dev", "aws_kms", "gcp_kms"])
    .default("local_dev"),
  AWS_REGION: z.string().default("ap-northeast-1"),
  AWS_KMS_KEY_ID: z.string().optional(),
  KEEPA_API_KEY: z.string().optional(),
  RAKUTEN_APPLICATION_ID: z.string().optional(),
  RAKUTEN_APP_ID: z.string().optional(),
  RAKUTEN_ACCESS_KEY: z.string().optional(),
  RAKUTEN_AFFILIATE_ID: z.string().optional(),
  RAKUTEN_PROXY_URL: z.string().url().optional(),
  RAKUTEN_PROXY_API_KEY: z.string().optional(),
  YAHOO_CLIENT_ID: z.string().optional(),
  YAHOO_CLIENT_SECRET: z.string().optional(),
  AMAZON_SP_API_ENABLED: z.string().default("false")
});

export const env = envSchema.parse(process.env);
