import type { PrepSheet } from "@/lib/sheet";
import { indexNight } from "@/lib/similar";
import { rememberRun } from "@/lib/memory";

export async function savePrepRun(sheet: PrepSheet): Promise<string> {
  return rememberRun(sheet);
}

export async function indexPrepNight(sheet: PrepSheet): Promise<string> {
  const notes = `${sheet.neighborhood} ${sheet.serviceDate}. ${sheet.sign}. ${sheet.notes}`;
  try {
    await indexNight(sheet.runId || `run-${sheet.serviceDate}`, notes);
    return process.env.TIGER_DATABASE_URL ? "tiger" : "skipped";
  } catch (error) {
    return error instanceof Error ? `skipped (${error.message})` : "skipped";
  }
}
