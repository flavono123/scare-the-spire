import type { CharacterClass } from "@/lib/types";
import { Badge } from "@/components/ui/badge";

export const CHARACTER_RING: Record<CharacterClass, string> = {
  Ironclad: "ring-2 ring-red-500/50",
  Silent: "ring-2 ring-green-500/50",
  Defect: "ring-2 ring-blue-500/50",
  Watcher: "ring-2 ring-purple-500/50",
};

export function CharacterBadge({
  character,
  className,
}: {
  character: CharacterClass | null;
  className?: string;
}) {
  if (!character) return null;
  return (
    <Badge variant="outline" className={className}>
      {character}
    </Badge>
  );
}

export function characterRing(character: CharacterClass | null): string {
  return character ? CHARACTER_RING[character] ?? "" : "";
}
