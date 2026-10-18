import { Connection, Client } from "@temporalio/client";
import type { PrepSheet } from "@/lib/sheet";
import { indexPrepNight } from "@/temporal/activities";

export async function schedulePrep(sheet: PrepSheet): Promise<string> {
  const address = process.env.TEMPORAL_ADDRESS ?? "localhost:7233";
  try {
    const connection = await Promise.race([
      Connection.connect({ address }),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("temporal offline")), 1500);
      }),
    ]);
    const client = new Client({ connection });
    const handle = await client.workflow.start("prepNightWorkflow", {
      taskQueue: "nightprep",
      workflowId: `nightprep-${sheet.runId}`,
      args: [sheet],
    });
    await connection.close();
    return `temporal:${handle.workflowId}`;
  } catch {
    const index = await indexPrepNight(sheet);
    return `temporal-offline/${index}`;
  }
}
