import type { Metadata } from "next";
import { loadAllEntities } from "@/lib/load-all-entities";
import { ChemicalXClient } from "@/components/chemicalx/chemicalx-client";

export const metadata: Metadata = {
  title: "케미컬엑스",
};

export default async function ChemicalXPage() {
  const entities = await loadAllEntities();

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <ChemicalXClient entities={entities} />
    </div>
  );
}
