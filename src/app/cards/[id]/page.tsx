import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getCards, getChanges } from "@/lib/data";
import { Badge } from "@/components/ui/badge";
import { ChangeList } from "@/components/change-list";

export async function generateStaticParams() {
  const cards = await getCards();
  return cards.map((c) => ({ id: c.id }));
}

export default async function CardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [cards, changes] = await Promise.all([getCards(), getChanges()]);
  const card = cards.find((c) => c.id === id);
  if (!card) notFound();

  const cardChanges = changes.filter(
    (c) => c.entityType === "card" && c.entityId === id,
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <Link
        href="/cards"
        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        &larr; 카드 목록
      </Link>

      <div className="mt-4 flex gap-6">
        <Image
          src={`/images/cards/${card.id}.webp`}
          alt={card.name}
          width={170}
          height={219}
          className="rounded-lg shrink-0"
        />
        <div>
          <h1 className="text-2xl font-bold">{card.nameKo}</h1>
          <p className="text-sm text-muted-foreground">{card.name}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge variant="outline">
              {card.cardType === "attack" ? "공격" : card.cardType === "skill" ? "스킬" : card.cardType === "power" ? "파워" : card.cardType}
            </Badge>
            <Badge variant="outline">
              비용: {typeof card.cost === "number" ? card.cost : card.cost}
            </Badge>
          </div>
          {card.description && (
            <p className="mt-3 text-sm text-muted-foreground">
              {card.description}
            </p>
          )}
        </div>
      </div>

      {cardChanges.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-yellow-500 mb-4">
            변경 이력 ({cardChanges.length})
          </h2>
          <ChangeList changes={cardChanges} />
        </section>
      )}
    </div>
  );
}
