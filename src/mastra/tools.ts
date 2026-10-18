import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { buildForecast } from "@/lib/forecast";
import { findEvents } from "@/lib/events";
import { recentRuns } from "@/lib/memory";
import { findSimilarNights } from "@/lib/similar";

const tonightInput = z.object({
  city: z.string(),
  neighborhood: z.string(),
  serviceDate: z.string(),
  tempF: z.number(),
  rain: z.boolean(),
  notes: z.string().default(""),
});

export const forecastTool = createTool({
  id: "forecast-units",
  description: "Forecast unit sales for each menu item from the truck's history.",
  inputSchema: tonightInput,
  outputSchema: z.object({
    source: z.string(),
    lines: z.array(z.object({ item: z.string(), units: z.number(), price: z.number() })),
  }),
  execute: async (input) => buildForecast(input),
});

export const similarNightsTool = createTool({
  id: "similar-nights",
  description: "Find past service nights with similar notes using hybrid search.",
  inputSchema: z.object({ query: z.string() }),
  outputSchema: z.object({
    source: z.string(),
    nights: z.array(z.object({ id: z.string(), notes: z.string(), distance: z.number() })),
  }),
  execute: async ({ query }) => findSimilarNights(query),
});

export const localEventsTool = createTool({
  id: "local-events",
  description: "Search the live web for events near tonight's stop.",
  inputSchema: tonightInput,
  outputSchema: z.object({
    source: z.string(),
    events: z.array(z.object({ title: z.string(), link: z.string() })),
  }),
  execute: async (input) => findEvents(input),
});

export const memoryTool = createTool({
  id: "recent-signs",
  description: "Read the last sidewalk signs saved for this neighborhood.",
  inputSchema: z.object({ neighborhood: z.string() }),
  outputSchema: z.object({ signs: z.array(z.string()) }),
  execute: async ({ neighborhood }) => ({ signs: await recentRuns(neighborhood) }),
});
