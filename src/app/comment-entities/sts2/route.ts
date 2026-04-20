import { loadAllEntities } from "@/lib/load-all-entities";

export const dynamic = "force-static";

export async function GET() {
  const entities = await loadAllEntities();
  return Response.json(entities);
}
