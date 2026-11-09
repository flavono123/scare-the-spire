import { NextResponse } from "next/server";
import { devToolsEnabled } from "@/lib/dev-tools";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Count of inquiries still in the "new" (접수) state, for the dev mailbox pip. */
export async function GET() {
  if (!devToolsEnabled()) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  // Both envs' D1 (production and testbed), as the Supabase count had no env filter.
  const [{ adminDeps }, { countUncheckedInquiries }] = await Promise.all([
    import("../../../../../scripts/admin/admin-deps"),
    import("../../../../../scripts/admin/admin-reads"),
  ]);
  try {
    return NextResponse.json({ unchecked: await countUncheckedInquiries(adminDeps().d1) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown D1 error";
    return NextResponse.json({ message }, { status: 502 });
  }
}
