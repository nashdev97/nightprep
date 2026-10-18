import { createWorkflow, createStep } from "@mastra/core/workflows";
import { randomUUID } from "node:crypto";
import { buildForecast } from "@/lib/forecast";
import { draftCopy, voiceScript } from "@/lib/gemma";
import { findEvents } from "@/lib/events";
import { rememberRun } from "@/lib/memory";
import { findSimilarNights } from "@/lib/similar";
import { sheetSchema, type PrepSheet } from "@/lib/sheet";
import { traced } from "@/lib/sentry";
import { schedulePrep } from "@/temporal/client";

const forecastStep = createStep({
  id: "forecast",
  inputSchema: sheetSchema,
  outputSchema: sheetSchema,
  execute: async ({ inputData }) => {
    const forecast = await traced("tabpfn-forecast", "gen_ai.invoke_agent", () =>
      buildForecast(inputData),
    );
    return {
      ...inputData,
      forecast: forecast.lines,
      sources: { ...inputData.sources, forecast: forecast.source },
    };
  },
});

const similarStep = createStep({
  id: "similar-nights",
  inputSchema: sheetSchema,
  outputSchema: sheetSchema,
  execute: async ({ inputData }) => {
    const query = `${inputData.neighborhood} ${inputData.notes} rain:${inputData.rain}`;
    const similar = await traced("tiger-similar", "db.query", () => findSimilarNights(query));
    return {
      ...inputData,
      similar: similar.nights,
      sources: { ...inputData.sources, similar: similar.source },
    };
  },
});

const eventsStep = createStep({
  id: "local-events",
  inputSchema: sheetSchema,
  outputSchema: sheetSchema,
  execute: async ({ inputData }) => {
    const events = await traced("serpapi-events", "gen_ai.execute_tool", () => findEvents(inputData));
    return {
      ...inputData,
      events: events.events,
      sources: { ...inputData.sources, events: events.source },
    };
  },
});

const draftStep = createStep({
  id: "gemma-draft",
  inputSchema: sheetSchema,
  outputSchema: sheetSchema,
  execute: async ({ inputData }) => {
    const draft = await traced("gemma-draft", "gen_ai.chat", () =>
      draftCopy(inputData, inputData.forecast, inputData.events),
    );
    return {
      ...inputData,
      sign: draft.sign,
      story: draft.story,
      voiceScript: voiceScript(inputData, inputData.forecast, draft.sign),
      sources: { ...inputData.sources, copy: draft.source },
    };
  },
});

const memoryStep = createStep({
  id: "remember",
  inputSchema: sheetSchema,
  outputSchema: sheetSchema,
  execute: async ({ inputData }) => {
    const runId = inputData.runId || randomUUID();
    const withId: PrepSheet = { ...inputData, runId };
    const memory = await traced("mongo-memory", "db.query", () => rememberRun(withId));
    return { ...withId, sources: { ...withId.sources, memory } };
  },
});

const scheduleStep = createStep({
  id: "schedule",
  inputSchema: sheetSchema,
  outputSchema: sheetSchema,
  execute: async ({ inputData }) => {
    const schedule = await traced("temporal-schedule", "queue.submit", () => schedulePrep(inputData));
    return { ...inputData, sources: { ...inputData.sources, schedule } };
  },
});

export const nightPrep = createWorkflow({
  id: "night-prep",
  inputSchema: sheetSchema,
  outputSchema: sheetSchema,
})
  .then(forecastStep)
  .then(similarStep)
  .then(eventsStep)
  .then(draftStep)
  .then(memoryStep)
  .then(scheduleStep)
  .commit();
