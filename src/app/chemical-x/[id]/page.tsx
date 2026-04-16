import type { Metadata } from "next";
import { loadAllEntities } from "@/lib/load-all-entities";
import { ChemicalXPostView } from "@/components/chemicalx/post-view";

export const metadata: Metadata = {
  title: "케미컬엑스",
};

export default async function ChemicalXPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const entities = await loadAllEntities();

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <ChemicalXPostView postId={id} entities={entities} />
    </div>
  );
}
