import { NextResponse } from "next/server";
import { devToolsEnabled } from "@/lib/dev-tools";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Count of inquiries still in the "new" (접수) state, for the dev mailbox pip. */
export async function GET() {
  if (!devToolsEnabled()) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  // Both envs (the Supabase count had no env filter), each from the store its replies write to.
  const [{ adminDeps }, { countUncheckedInquiries, SupabaseKeyMissingError }] = await Promise.all([
    import("../../../../../scripts/admin/admin-deps"),
    import("../../../../../scripts/admin/admin-reads"),
  ]);
  try {
    return NextResponse.json({ unchecked: await countUncheckedInquiries(adminDeps()) });
  } catch (error) {
    if (error instanceof SupabaseKeyMissingError) {
      return NextResponse.json({ message: "Supabase admin key is not configured." }, { status: 503 });
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ message }, { status: 502 });
  }
}
