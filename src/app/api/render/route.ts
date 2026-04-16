import { NextRequest, NextResponse } from "next/server";
import { renderTopology } from "@/lib/netauto";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { yaml: string };
    if (!body.yaml || typeof body.yaml !== "string") {
      return NextResponse.json({ error: "Missing 'yaml' field in request body" }, { status: 400 });
    }
    const results = renderTopology(body.yaml);
    return NextResponse.json({ results });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
