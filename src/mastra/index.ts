import { Agent } from "@mastra/core/agent";
import { Mastra } from "@mastra/core/mastra";
import { forecastTool, localEventsTool, memoryTool, similarNightsTool } from "./tools";
import { nightPrep } from "./workflow";

export const prepAgent = new Agent({
  id: "prep-agent",
  name: "NightPrep",
  instructions: `
You prep an independent food truck for tonight.
Call forecast-units, similar-nights, local-events, and recent-signs before you answer.
Use only numbers the forecast tool returns. Do not invent a street address.
Reply with a sidewalk sign under 12 words and two sentences the owner can post.
`,
  model: process.env.PREP_MODEL ?? "google/gemma-4-26b-a4b-it",
  tools: { forecastTool, similarNightsTool, localEventsTool, memoryTool },
});

export const mastra = new Mastra({
  agents: { prepAgent },
  workflows: { nightPrep },
});
