import { z } from "zod";

export const forecastLineSchema = z.object({
  item: z.string(),
  units: z.number(),
  price: z.number(),
});

export const similarSchema = z.object({
  id: z.string(),
  notes: z.string(),
  distance: z.number(),
});

export const eventSchema = z.object({
  title: z.string(),
  link: z.string(),
});

export const sourcesSchema = z.object({
  forecast: z.string(),
  similar: z.string(),
  events: z.string(),
  copy: z.string(),
  memory: z.string(),
  schedule: z.string(),
});

export const sheetSchema = z.object({
  city: z.string().min(1),
  neighborhood: z.string().min(1),
  serviceDate: z.string().min(4),
  tempF: z.number(),
  rain: z.boolean(),
  notes: z.string(),
  forecast: z.array(forecastLineSchema),
  similar: z.array(similarSchema),
  events: z.array(eventSchema),
  sign: z.string(),
  story: z.string(),
  voiceScript: z.string(),
  sources: sourcesSchema,
  runId: z.string(),
});

export const tonightSchema = sheetSchema.pick({
  city: true,
  neighborhood: true,
  serviceDate: true,
  tempF: true,
  rain: true,
  notes: true,
});

export type ForecastLine = z.infer<typeof forecastLineSchema>;
export type SimilarNight = z.infer<typeof similarSchema>;
export type LocalEvent = z.infer<typeof eventSchema>;
export type PrepSheet = z.infer<typeof sheetSchema>;
export type Tonight = z.infer<typeof tonightSchema>;

export function emptySheet(tonight: Tonight): PrepSheet {
  return {
    ...tonight,
    notes: tonight.notes ?? "",
    forecast: [],
    similar: [],
    events: [],
    sign: "",
    story: "",
    voiceScript: "",
    sources: {
      forecast: "pending",
      similar: "pending",
      events: "pending",
      copy: "pending",
      memory: "pending",
      schedule: "pending",
    },
    runId: "",
  };
}
