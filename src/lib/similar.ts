import pg from "pg";
import type { SimilarNight } from "@/lib/sheet";

const DIMS = 32;

export function hashEmbed(text: string): number[] {
  const vector = Array.from({ length: DIMS }, () => 0);
  const tokens = text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  for (const token of tokens) {
    let hash = 2166136261;
    for (let i = 0; i < token.length; i += 1) {
      hash = Math.imul(hash ^ token.charCodeAt(i), 16777619);
    }
    const index = Math.abs(hash) % DIMS;
    vector[index] += hash & 1 ? 1 : -1;
  }
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => value / norm);
}

function tigerPool(connectionString: string, max: number) {
  const url = new URL(connectionString);
  url.searchParams.delete("sslmode");
  return new pg.Pool({
    connectionString: url.toString(),
    max,
    ssl: { rejectUnauthorized: false },
  });
}
function vectorLiteral(values: number[]): string {
  return `[${values.map((value) => value.toFixed(6)).join(",")}]`;
}

const SEED = [
  {
    id: "seed-soccer",
    notes: "Saturday soccer let-out in East Cesar Chavez. Al pastor sold out by 8:40. Rain held off.",
  },
  {
    id: "seed-rain",
    notes: "Cold rain on a Thursday. Churros and horchata carried the night. Tacos slowed.",
  },
  {
    id: "seed-market",
    notes: "Sunday market foot traffic. Elote and agua de jamaica moved. Short line, steady till close.",
  },
];

function localSimilar(query: string): SimilarNight[] {
  const queryVector = hashEmbed(query);
  return SEED.map((night) => {
    const nightVector = hashEmbed(night.notes);
    const distance = Math.sqrt(
      queryVector.reduce((sum, value, index) => sum + (value - nightVector[index]) ** 2, 0),
    );
    return { id: night.id, notes: night.notes, distance: Number(distance.toFixed(3)) };
  }).sort((a, b) => a.distance - b.distance);
}

export async function findSimilarNights(query: string): Promise<{ nights: SimilarNight[]; source: string }> {
  const connectionString = process.env.TIGER_DATABASE_URL;
  if (!connectionString) return { nights: localSimilar(query), source: "local-seed" };

  const pool = tigerPool(connectionString, 2);
  try {
    await pool.query("CREATE EXTENSION IF NOT EXISTS vector");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS nights (
        id text PRIMARY KEY,
        notes text NOT NULL,
        body text NOT NULL,
        embedding vector(${DIMS})
      )
    `);
    const count = await pool.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM nights");
    if (count.rows[0]?.count === "0") {
      for (const night of SEED) {
        await pool.query(
          "INSERT INTO nights (id, notes, body, embedding) VALUES ($1, $2, $2, $3::vector)",
          [night.id, night.notes, vectorLiteral(hashEmbed(night.notes))],
        );
      }
    }
    const embedded = vectorLiteral(hashEmbed(query));
    const found = await pool.query<{ id: string; notes: string; distance: number }>(
      `
        SELECT id, notes,
          (embedding <=> $1::vector) AS distance
        FROM nights
        WHERE to_tsvector('english', body) @@ plainto_tsquery('english', $2)
           OR (embedding <=> $1::vector) < 1.5
        ORDER BY (embedding <=> $1::vector) ASC
        LIMIT 3
      `,
      [embedded, query],
    );
    if (found.rows.length === 0) return { nights: localSimilar(query), source: "tiger-empty" };
    return {
      source: "tiger-pgvector",
      nights: found.rows.map((row) => ({
        id: row.id,
        notes: row.notes,
        distance: Number(row.distance),
      })),
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Tiger query failed";
    return { nights: localSimilar(query), source: `local-seed (${reason})` };
  } finally {
    await pool.end();
  }
}

export async function indexNight(id: string, notes: string): Promise<void> {
  const connectionString = process.env.TIGER_DATABASE_URL;
  if (!connectionString) return;
  const pool = tigerPool(connectionString, 1);
  try {
    await pool.query(
      `
        INSERT INTO nights (id, notes, body, embedding)
        VALUES ($1, $2, $2, $3::vector)
        ON CONFLICT (id) DO UPDATE SET notes = EXCLUDED.notes, body = EXCLUDED.body, embedding = EXCLUDED.embedding
      `,
      [id, notes, vectorLiteral(hashEmbed(notes))],
    );
  } finally {
    await pool.end();
  }
}
