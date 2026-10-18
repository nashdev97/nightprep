import { proxyActivities } from "@temporalio/workflow";
import type { PrepSheet } from "@/lib/sheet";
import type * as activities from "./activities";

const { savePrepRun, indexPrepNight } = proxyActivities<typeof activities>({
  startToCloseTimeout: "1 minute",
  retry: { maximumAttempts: 4, initialInterval: "1 second" },
});

export async function prepNightWorkflow(sheet: PrepSheet): Promise<{ memory: string; index: string }> {
  const memory = await savePrepRun(sheet);
  const index = await indexPrepNight(sheet);
  return { memory, index };
}
