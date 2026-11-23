import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { devToolsEnabled } from "@/lib/dev-tools";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const notFound = () => NextResponse.json({ message: "Not found" }, { status: 404 });

/** One catalogue image for /dev/admin?tab=glyphs, read from data/dev so it never ships as a public asset. */
export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  // The name is the only user input: letters, digits and dashes cannot leave the folder.
  if (!devToolsEnabled() || !/^[a-z0-9-]+\.webp$/.test(file)) return notFound();
  try {
    const body = await readFile(path.join(process.cwd(), "data", "dev", "spire-glyphs", file));
    return new NextResponse(new Uint8Array(body), { headers: { "Content-Type": "image/webp" } });
  } catch {
    return notFound();
  }
}
