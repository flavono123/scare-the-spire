import { handleLinkPreviewRequest } from "@/lib/link-preview-handler";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Production serves this path from the static main Worker with the same
// handler; this route keeps `next dev` working.
export async function GET(request: Request) {
  return handleLinkPreviewRequest(request);
}
