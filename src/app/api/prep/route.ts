import { NextResponse } from "next/server";
import { emptySheet, tonightSchema } from "@/lib/sheet";
import { mastra } from "@/mastra";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send JSON." }, { status: 400 });
  }
  const parsed = tonightSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Need city, neighborhood, serviceDate, tempF, and rain." },
      { status: 400 },
    );
  }

  const workflow = mastra.getWorkflow("nightPrep");
  const run = await workflow.createRun();
  const result = await run.start({ inputData: emptySheet(parsed.data) });
  if (result.status !== "success") {
    const message = result.status === "failed" ? String(result.error) : result.status;
    return NextResponse.json({ error: message }, { status: 500 });
  }
  return NextResponse.json(result.result);
}
