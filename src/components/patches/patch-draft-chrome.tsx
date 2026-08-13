import Image from "@/components/ui/static-image";
import { SpireIcon } from "@/components/spire-icon";
import type { ServiceLocale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const PATCH_DRAFT_TOKEN = {
  src: "/images/sts2/powers/furnace_power.webp",
  alt: { ko: "용광로", en: "Furnace" },
  variant: "purple",
} as const;

export function PatchDraftChip({
  title,
  notice,
  serviceLocale,
  className,
}: {
  title: string;
  notice: string;
  serviceLocale: ServiceLocale;
  className?: string;
}) {
  return (
    <span
      data-patch-draft-chip=""
      data-patch-chip="draft"
      className={cn("group/draft-chip relative z-20 inline-flex shrink-0 hover:z-50", className)}
    >
      <span
        aria-label={`${title}. ${notice}`}
        className="inline-flex items-center gap-1 font-game-title text-[13px] font-bold leading-none text-[#EFC851]"
      >
        <SpireIcon
          src={PATCH_DRAFT_TOKEN.src}
          label={PATCH_DRAFT_TOKEN.alt[serviceLocale]}
          size={14}
          variant={PATCH_DRAFT_TOKEN.variant}
          className="patch-draft-ember"
        />
        {title}
      </span>
      <span
        className="pointer-events-none invisible absolute left-1/2 top-full z-50 mt-0.5 -translate-x-1/2 group-hover/draft-chip:visible group-focus-within/draft-chip:visible"
        role="tooltip"
      >
        <span
          className="relative block whitespace-nowrap"
          style={{
            borderImage: "url('/images/sts2/ui/hover_tip.png') 43 91 32 55 fill",
            borderImageWidth: "16px 34px 12px 20px",
            borderStyle: "solid",
            padding: "2px 12px 6px 8px",
          }}
        >
          <span
            className="text-xs font-bold"
            style={{
              color: "rgb(239, 200, 81)",
              textShadow: "2px 1px 0 rgba(0,0,0,0.25)",
            }}
          >
            {notice}
          </span>
        </span>
      </span>
    </span>
  );
}

export function PatchDraftNotice({
  title,
  notice,
  serviceLocale,
}: {
  title: string;
  notice: string;
  serviceLocale: ServiceLocale;
}) {
  return (
    <div
      data-patch-draft-notice=""
      className="pointer-events-none fixed inset-x-0 top-12 z-40 flex justify-center px-3 pt-2"
    >
      <p
        role="status"
        className="pointer-events-auto flex max-w-2xl items-center gap-2 rounded-md border border-orange-400/45 bg-[#1a0c06]/92 px-3 py-2 text-sm text-[#FFF6E2] shadow-[0_8px_24px_rgba(0,0,0,0.45)] backdrop-blur-sm"
      >
        <Image
          src={PATCH_DRAFT_TOKEN.src}
          alt={PATCH_DRAFT_TOKEN.alt[serviceLocale]}
          width={22}
          height={22}
          className="patch-draft-ember h-5 w-5 shrink-0 object-contain"
        />
        <span className="min-w-0">
          <span className="font-game-title font-bold text-[#EFC851]">{title}</span>
          <span className="text-[#FFF6E2]/85"> — {notice}</span>
        </span>
      </p>
    </div>
  );
}
