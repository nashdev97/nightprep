import * as Sentry from "@sentry/node";

let started = false;

export function initSentry(): boolean {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return false;
  if (!started) {
    Sentry.init({
      dsn,
      tracesSampleRate: 1,
      sendDefaultPii: false,
    });
    started = true;
  }
  return true;
}

export async function traced<T>(name: string, op: string, fn: () => Promise<T>): Promise<T> {
  if (!initSentry()) return fn();
  return Sentry.startSpan({ name, op }, fn);
}
