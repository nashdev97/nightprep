import type { PrepSheet } from "@/lib/sheet";

export async function rememberRun(sheet: PrepSheet): Promise<string> {
  const uri = process.env.MONGODB_URI;
  if (!uri) return "skipped";
  const { MongoClient } = await import("mongodb");
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(process.env.MONGODB_DB ?? "nightprep");
    await db.collection("prep_runs").replaceOne(
      { runId: sheet.runId },
      {
        runId: sheet.runId,
        city: sheet.city,
        neighborhood: sheet.neighborhood,
        serviceDate: sheet.serviceDate,
        forecast: sheet.forecast,
        sign: sheet.sign,
        story: sheet.story,
        notes: sheet.notes,
        sources: sheet.sources,
        createdAt: new Date(),
      },
      { upsert: true },
    );
    await db.collection("menus").updateOne(
      { neighborhood: sheet.neighborhood },
      {
        $set: {
          city: sheet.city,
          items: sheet.forecast.map((line) => line.item),
          updatedAt: new Date(),
        },
      },
      { upsert: true },
    );
    return "mongodb";
  } catch (error) {
    return error instanceof Error ? `skipped (${error.message})` : "skipped";
  } finally {
    await client.close();
  }
}

export async function recentRuns(neighborhood: string): Promise<string[]> {
  const uri = process.env.MONGODB_URI;
  if (!uri) return [];
  const { MongoClient } = await import("mongodb");
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(process.env.MONGODB_DB ?? "nightprep");
    const rows = await db
      .collection("prep_runs")
      .find({ neighborhood })
      .sort({ createdAt: -1 })
      .limit(3)
      .toArray();
    return rows.map((row) => String(row.sign ?? "")).filter(Boolean);
  } catch {
    return [];
  } finally {
    await client.close();
  }
}
