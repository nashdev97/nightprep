import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { NativeConnection, Worker } from "@temporalio/worker";
import * as activities from "./activities";

function loadLocalEnv(): void {
  try {
    const text = readFileSync(new URL("../../.env.local", import.meta.url), "utf8");
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, "");
    }
  } catch {
    // The Next.js app still has the file. The worker can run without it.
  }
}

async function main(): Promise<void> {
  loadLocalEnv();
  const address = process.env.TEMPORAL_ADDRESS ?? "localhost:7233";
  const connection = await NativeConnection.connect({ address });
  const worker = await Worker.create({
    connection,
    workflowsPath: fileURLToPath(new URL("./workflows.ts", import.meta.url)),
    activities,
    taskQueue: "nightprep",
  });
  await worker.run();
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "worker failed";
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
