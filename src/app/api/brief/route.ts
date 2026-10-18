import { NextResponse } from "next/server";
import { speakBrief } from "@/lib/voice";

export async function POST(request: Request) {
  let script = "";
  try {
    const body = (await request.json()) as { script?: unknown };
    script = typeof body.script === "string" ? body.script : "";
  } catch {
    return NextResponse.json({ error: "Send JSON." }, { status: 400 });
  }
  if (!script.trim()) return NextResponse.json({ error: "Need a script." }, { status: 400 });
  const spoken = await speakBrief(script);
  if (!spoken.audio) {
    return NextResponse.json({ error: "Voice needs ELEVENLABS_API_KEY.", source: spoken.source }, { status: 503 });
  }
  return new NextResponse(new Uint8Array(spoken.audio), {
    headers: { "Content-Type": "audio/mpeg", "X-Voice-Source": spoken.source },
  });
}
