import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getPotions, getChanges } from "@/lib/data";
import { ChangeList } from "@/components/change-list";
import { CharacterBadge } from "@/components/character-badge";

export async function generateStaticParams() {
  const potions = await getPotions();
  return potions.map((p) => ({ id: p.id }));
}

export default async function PotionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [potions, changes] = await Promise.all([getPotions(), getChanges()]);
  const potion = potions.find((p) => p.id === id);
  if (!potion) notFound();

  const potionChanges = changes.filter(
    (c) => c.entityType === "potion" && c.entityId === id,
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <Link
        href="/potions"
        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        &larr; 포션 목록
      </Link>

      <div className="mt-4 flex gap-6 items-start">
        <Image
          src={`/images/potions/${potion.id}.webp`}
          alt={potion.name}
          width={64}
          height={64}
          className="shrink-0"
        />
        <div>
          <h1 className="text-2xl font-bold">{potion.nameKo}</h1>
          <p className="text-sm text-muted-foreground">{potion.name}</p>
          <CharacterBadge character={potion.character} className="mt-1" />
          <p className="mt-3 text-sm text-muted-foreground">
            {potion.description}
          </p>
        </div>
      </div>

      {potionChanges.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-yellow-500 mb-4">
            변경 이력 ({potionChanges.length})
          </h2>
          <ChangeList changes={potionChanges} />
        </section>
      )}
    </div>
  );
}
