import { NextResponse } from "next/server";
import { COLORFUL_PHILOSOPHER_SLOTS, colorfulPhilosophersNextWeekStart } from "@/lib/colorful-philosophers";
import { devToolsEnabled } from "@/lib/dev-tools";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Whether next week's production reservation is missing a slot (the dev menu's dot), from the store
 * the save writes to (production D1 once some group is on d1, Supabase before).
 */
export async function GET() {
  if (!devToolsEnabled()) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const [{ adminDeps }, { philosopherWeekSlots, SupabaseKeyMissingError }] = await Promise.all([
    import("../../../../../../scripts/admin/admin-deps"),
    import("../../../../../../scripts/admin/admin-reads"),
  ]);

  try {
    const filled = new Set(await philosopherWeekSlots(adminDeps(), colorfulPhilosophersNextWeekStart()));
    return NextResponse.json({ open: COLORFUL_PHILOSOPHER_SLOTS.some((slot) => !filled.has(slot)) });
  } catch (error) {
    if (error instanceof SupabaseKeyMissingError) {
      return NextResponse.json({ message: "Supabase admin key is not configured." }, { status: 503 });
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ message }, { status: 502 });
  }
}
