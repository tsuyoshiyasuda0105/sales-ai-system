import { env } from "@/lib/env";

/**
 * Minimal best-effort error notification.
 *
 * Posts a Slack-compatible `{ text }` payload to ALERT_WEBHOOK_URL if it's set.
 * Discord webhooks accept the same shape when the URL ends with `/slack`.
 *
 * Design constraints:
 * - Must never throw. A notification failure should not break the caller
 *   (it's already an error path).
 * - Must time out quickly (~3s) so a stuck webhook never blocks a cron job
 *   that has a 10-second hard limit on Vercel Hobby.
 * - Must no-op silently when ALERT_WEBHOOK_URL is not configured, so local
 *   dev and the demo deployment don't spam an inbox.
 *
 * This file intentionally avoids any third-party SDK (Sentry, etc.) to keep
 * the dependency footprint zero. If/when the user wants real APM, swap the
 * body of notifyError for a `Sentry.captureException(error)` call — the rest
 * of the codebase can keep calling notifyError unchanged.
 */

export type NotifyContext = {
  /** Where the error happened, e.g. "cron/rakuten-daily-sweep". */
  source: string;
  /** Additional structured info. Will be JSON-stringified. */
  extra?: Record<string, unknown>;
};

const TIMEOUT_MS = 3000;
const MAX_MESSAGE_LENGTH = 1800; // Slack/Discord text limit safety

export async function notifyError(error: unknown, context: NotifyContext): Promise<void> {
  // Always log first so Vercel function logs preserve the error even if the
  // webhook is unset or fails to deliver.
  console.error(`[notify] ${context.source}:`, error, context.extra ?? "");

  if (!env.ALERT_WEBHOOK_URL) {
    return;
  }

  const text = formatErrorText(error, context);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    await fetch(env.ALERT_WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
      signal: controller.signal,
      cache: "no-store"
    });
  } catch (notifyError) {
    // Swallow — caller is already in an error handler and we promised not to throw.
    console.error("[notify] webhook delivery failed:", notifyError);
  } finally {
    clearTimeout(timer);
  }
}

function formatErrorText(error: unknown, context: NotifyContext): string {
  const envLabel = env.ALERT_ENV_NAME ?? "sedori-ai";
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error && error.stack ? firstStackFrames(error.stack, 4) : null;
  const extra = context.extra ? safeStringify(context.extra) : null;

  const lines = [
    `:rotating_light: [${envLabel}] ${context.source} failed`,
    `Error: ${message}`,
    stack ? `Stack: ${stack}` : null,
    extra ? `Context: ${extra}` : null,
    `Time: ${new Date().toISOString()}`
  ].filter(Boolean);

  const text = lines.join("\n");

  return text.length > MAX_MESSAGE_LENGTH ? `${text.slice(0, MAX_MESSAGE_LENGTH)}\n…(truncated)` : text;
}

function firstStackFrames(stack: string, count: number): string {
  return stack.split("\n").slice(1, 1 + count).map((line) => line.trim()).join(" / ");
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 0).slice(0, 600);
  } catch {
    return String(value);
  }
}
