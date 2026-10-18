import type { LocalEvent, Tonight } from "@/lib/sheet";

export async function findEvents(tonight: Tonight): Promise<{ events: LocalEvent[]; source: string }> {
  const key = process.env.SERPAPI_KEY;
  if (!key) return { events: [], source: "none" };
  const query = `events in ${tonight.neighborhood} ${tonight.city} on ${tonight.serviceDate}`;
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google");
  url.searchParams.set("q", query);
  url.searchParams.set("api_key", key);
  try {
    const response = await fetch(url);
    if (!response.ok) return { events: [], source: `none (serpapi ${response.status})` };
    const body = (await response.json()) as {
      organic_results?: Array<{ title?: string; link?: string }>;
    };
    const events = (body.organic_results ?? [])
      .filter((row) => row.title && row.link)
      .slice(0, 3)
      .map((row) => ({ title: row.title as string, link: row.link as string }));
    return { events, source: events.length ? "serpapi" : "serpapi-empty" };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "SerpApi failed";
    return { events: [], source: `none (${reason})` };
  }
}
