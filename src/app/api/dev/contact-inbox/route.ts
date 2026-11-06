import { NextResponse } from "next/server";
import { devToolsEnabled } from "@/lib/dev-tools";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Count of inquiries still in the "new" (접수) state, for the dev mailbox pip. */
export async function GET() {
  if (!devToolsEnabled()) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim()
    || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !secretKey) {
    return NextResponse.json({ message: "Supabase admin key is not configured." }, { status: 503 });
  }

  const [{ createClient }, { withSupabaseTimeout }] = await Promise.all([
    import("@supabase/supabase-js"),
    import("@/lib/supabase-timeout"),
  ]);
  const admin = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  try {
    const { count, error } = await withSupabaseTimeout(
      "dev.contact-inbox.unchecked",
      admin
        .from("contact_inquiries")
        .select("id", { count: "exact", head: true })
        .eq("status", "new"),
    );
    if (error) return NextResponse.json({ message: error.message }, { status: 502 });
    return NextResponse.json({ unchecked: count ?? 0 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Supabase error";
    return NextResponse.json({ message }, { status: 504 });
  }
}
