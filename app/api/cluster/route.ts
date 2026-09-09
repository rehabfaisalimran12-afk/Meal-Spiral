import { NextResponse } from "next/server";
import { getClusters } from "@/lib/clusterer";

export async function POST() {
  const result = await getClusters();

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status });
  }

  return NextResponse.json(result.clusters, { status: 200 });
}
