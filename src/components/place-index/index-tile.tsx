import Link from "next/link";
import { NavAttentionDot } from "@/components/nav-attention-dot";
import Image from "@/components/ui/static-image";
import { cn } from "@/lib/utils";

export type IndexTileProps = {
  href: string;
  label: string;
  token: string;
  tokenClassName?: string;
  art?: string;
  isNew?: boolean;
  newLabel: string;
  /** nav-seen surface id; NavAttentionMarkers shows the yellow dot when it has new posts. */
  attentionId?: string;
  /** Tokens shown under the name of a large tile (조각모음's services). */
  kids?: { token: string; label: string }[];
};

function NewMark({ label }: { label: string }) {
  return (
    <span className="rounded border border-emerald-400/40 bg-emerald-500/15 px-1 font-game-text text-[10px] font-bold leading-4 text-emerald-300">
      {label}
    </span>
  );
}

/** Wide tile like the home reel: art on the left, token and name on the right. */
export function IndexTileLarge({ href, label, token, art, isNew, newLabel, attentionId, kids }: IndexTileProps) {
  return (
    <Link
      href={href}
      prefetch={false}
      className="group relative col-span-2 flex min-h-32 overflow-hidden rounded-xl border border-border bg-card/80 transition-colors hover:border-primary/40"
    >
      {art && (
        <span className="relative w-2/5 shrink-0 overflow-hidden">
          <Image src={art} alt="" fill sizes="(max-width: 640px) 40vw, 320px" className="object-cover opacity-80 transition-transform duration-300 group-hover:scale-105" />
          <span className="absolute inset-0 bg-gradient-to-r from-transparent to-card/90" />
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col justify-center gap-2 p-4">
        <span className="flex items-center gap-2">
          <Image src={token} alt="" width={40} height={40} className="h-9 w-9 shrink-0 object-contain" />
          <span className="font-game-title text-lg text-primary">{label}</span>
          {isNew && <NewMark label={newLabel} />}
        </span>
        {kids && kids.length > 0 && (
          <span className="flex flex-wrap gap-1.5">
            {kids.map((kid) => (
              <Image key={kid.token} src={kid.token} alt={kid.label} title={kid.label} width={24} height={24} className="h-6 w-6 object-contain" />
            ))}
          </span>
        )}
      </span>
      {attentionId && (
        <span className="absolute right-2 top-2">
          <NavAttentionDot marker={attentionId} dormant />
        </span>
      )}
    </Link>
  );
}

/** Thumbnail like a History Course cover: the art fills the tile, token and name sit on it. */
export function IndexTileSmall({ href, label, token, tokenClassName, art, isNew, newLabel, attentionId }: IndexTileProps) {
  return (
    <Link
      href={href}
      prefetch={false}
      className="group relative flex aspect-[16/10] flex-col justify-end overflow-hidden rounded-xl border border-border bg-card/80 transition-colors hover:border-primary/40"
    >
      {art && (
        <Image src={art} alt="" fill sizes="(max-width: 640px) 50vw, 240px" className="object-cover opacity-45 transition-transform duration-300 group-hover:scale-105" />
      )}
      <span className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/50 to-transparent" />
      <span className="relative flex items-center gap-2 p-2.5">
        <Image src={token} alt="" width={32} height={32} className={cn("h-7 w-7 shrink-0 object-contain", tokenClassName)} />
        <span className="min-w-0 truncate font-game-title text-sm text-primary sm:text-base">{label}</span>
        {isNew && <NewMark label={newLabel} />}
      </span>
      {attentionId && (
        <span className="absolute right-2 top-2">
          <NavAttentionDot marker={attentionId} dormant />
        </span>
      )}
    </Link>
  );
}
