import { NextResponse } from "next/server";
import { buildSearchIndexPayload } from "@/lib/search-index-data";

export const dynamic = "force-static";

export async function GET() {
  return NextResponse.json(await buildSearchIndexPayload());
}
