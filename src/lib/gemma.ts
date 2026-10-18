import type { ForecastLine, LocalEvent, Tonight } from "@/lib/sheet";

type Draft = { sign: string; story: string; source: string };

function templateDraft(tonight: Tonight, forecast: ForecastLine[], events: LocalEvent[]): Draft {
  const ranked = [...forecast].sort((a, b) => b.units - a.units);
  const lead = ranked[0];
  const eventBit = events[0] ? ` ${events[0].title} is nearby.` : "";
  return {
    source: "template",
    sign: `${tonight.neighborhood} tonight — ${lead?.item ?? "tacos"} until we sell through`,
    story: `Parked in ${tonight.neighborhood}. Prep ${lead?.units ?? 0} ${lead?.item ?? "orders"} first.${eventBit} ${tonight.notes}`.trim(),
  };
}

function repeats(text: string): boolean {
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  for (let size = 3; size <= 8; size += 1) {
    if (words.length < size * 3) continue;
    const tail = words.slice(-size).join(" ");
    let hits = 0;
    for (let i = 0; i <= words.length - size; i += 1) {
      if (words.slice(i, i + size).join(" ") === tail) hits += 1;
    }
    if (hits >= 3) return true;
  }
  return false;
}

function parseDraft(text: string): { sign: string; story: string } | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1)) as { sign?: unknown; story?: unknown };
    if (typeof parsed.sign !== "string" || typeof parsed.story !== "string") return null;
    const sign = parsed.sign.trim().slice(0, 140);
    const story = parsed.story.trim().slice(0, 500);
    if (!sign || !story || repeats(sign) || repeats(story)) return null;
    return { sign, story };
  } catch {
    return null;
  }
}

function promptFor(tonight: Tonight, forecast: ForecastLine[], events: LocalEvent[]): string {
  const lines = forecast.map((line) => `${line.item}: ${line.units}`).join(", ");
  const eventText = events.map((event) => event.title).join("; ") || "none found";
  return [
    "Write a sidewalk sign and an Instagram story for an independent food truck.",
    "Use only the facts below. Do not invent anniversaries, addresses, or prices. Do not mention unit counts.",
    "Return only JSON with keys sign and story.",
    `City: ${tonight.city}`,
    `Neighborhood: ${tonight.neighborhood}`,
    `Date: ${tonight.serviceDate}`,
    `Rain: ${tonight.rain ? "yes" : "no"}`,
    `Temperature F: ${tonight.tempF}`,
    `Owner notes: ${tonight.notes || "none"}`,
    `Prep units: ${lines}`,
    `Nearby events: ${eventText}`,
  ].join("\n");
}

async function ollamaReachable(host: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 700);
  try {
    const response = await fetch(`${host}/api/tags`, { signal: controller.signal });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function ollamaDraft(prompt: string): Promise<string | null> {
  const host = process.env.OLLAMA_HOST ?? "http://127.0.0.1:11434";
  if (!(await ollamaReachable(host))) return null;
  const model = process.env.OLLAMA_MODEL ?? "gemma3:4b";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(`${host}/api/chat`, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        stream: false,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { message?: { content?: string } };
    return body.message?.content ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const copySchema = {
  type: "OBJECT",
  properties: {
    sign: { type: "STRING", description: "Sidewalk sign, 12 words or fewer" },
    story: { type: "STRING", description: "One Instagram paragraph for tonight" },
  },
  required: ["sign", "story"],
};

async function googleDraft(prompt: string, jsonMode: boolean): Promise<string | null> {
  const key = process.env.GOOGLE_API_KEY;
  if (!key) return null;
  const model = process.env.GEMMA_MODEL ?? "gemma-4-26b-a4b-it";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  let response: Response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: jsonMode
          ? {
              temperature: 0.2,
              maxOutputTokens: 180,
              responseMimeType: "application/json",
              responseSchema: copySchema,
            }
          : { temperature: 0.2, maxOutputTokens: 180 },
        }),
        signal: controller.signal,
      },
    );
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) {
    if (jsonMode && response.status === 400) return googleDraft(prompt, false);
    throw new Error(`Gemma request failed (${response.status})`);
  }
  const body = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  return body.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? null;
}

export async function draftCopy(
  tonight: Tonight,
  forecast: ForecastLine[],
  events: LocalEvent[],
): Promise<Draft> {
  const fallback = templateDraft(tonight, forecast, events);
  const prompt = promptFor(tonight, forecast, events);
  const local = await ollamaDraft(prompt);
  if (local) {
    const parsed = parseDraft(local);
    if (parsed) return { ...parsed, source: "gemma-ollama" };
  }
  if (!process.env.GOOGLE_API_KEY) return fallback;
  try {
    const remote = await googleDraft(prompt, true);
    if (!remote) return { ...fallback, source: "template (empty gemma response)" };
    const parsed = parseDraft(remote);
    if (parsed) return { ...parsed, source: "gemma-google" };
    const repair = await googleDraft(
      `Previous reply failed. Need JSON with string keys sign and story only.\n${remote.slice(0, 800)}`,
      true,
    );
    const repaired = repair ? parseDraft(repair) : null;
    if (repaired) return { ...repaired, source: "gemma-google" };
    return { ...fallback, source: "template (gemma non-json)" };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Gemma failed";
    return { ...fallback, source: `template (${reason})` };
  }
}

export function voiceScript(tonight: Tonight, forecast: ForecastLine[], sign: string): string {
  const ranked = [...forecast].sort((a, b) => b.units - a.units).slice(0, 3);
  const list = ranked.map((line) => `${line.units} ${line.item}`).join(", ");
  return `Night prep for ${tonight.neighborhood}. Cook ${list}. Sign says: ${sign}`;
}
