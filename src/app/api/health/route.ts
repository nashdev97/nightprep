import { NextResponse } from "next/server";

const KEYS = [
  "PRIOR_API_KEY",
  "GOOGLE_API_KEY",
  "OLLAMA_HOST",
  "MONGODB_URI",
  "TIGER_DATABASE_URL",
  "SERPAPI_KEY",
  "ELEVENLABS_API_KEY",
  "SENTRY_DSN",
  "TEMPORAL_ADDRESS",
  "PREP_MODEL",
] as const;

export async function GET() {
  const present = Object.fromEntries(KEYS.map((key) => [key, Boolean(process.env[key])]));
  return NextResponse.json({ ok: true, present });
}
