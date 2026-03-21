import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getRelics, getChanges } from "@/lib/data";
import { Badge } from "@/components/ui/badge";
import { ChangeList } from "@/components/change-list";
import { CharacterBadge } from "@/components/character-badge";

export async function generateStaticParams() {
  const relics = await getRelics();
  return relics.map((r) => ({ id: r.id }));
}

export default async function RelicDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [relics, changes] = await Promise.all([getRelics(), getChanges()]);
  const relic = relics.find((r) => r.id === id);
  if (!relic) notFound();

  const relicChanges = changes.filter(
    (c) => c.entityType === "relic" && c.entityId === id,
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <Link
        href="/relics"
        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        &larr; 유물 목록
      </Link>

      <div className="mt-4 flex gap-6 items-start">
        <Image
          src={`/images/relics/${relic.id}.webp`}
          alt={relic.name}
          width={64}
          height={64}
          className="shrink-0"
        />
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{relic.nameKo}</h1>
            {relic.deprecated && (
              <Badge variant="outline" className="text-red-400 border-red-500/30">삭제됨</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{relic.name}</p>
          <CharacterBadge character={relic.character} className="mt-1" />
          <p className="mt-3 text-sm text-muted-foreground">
            {relic.description}
          </p>
        </div>
      </div>

      {relicChanges.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-yellow-500 mb-4">
            변경 이력 ({relicChanges.length})
          </h2>
          <ChangeList changes={relicChanges} />
        </section>
      )}
    </div>
  );
}
