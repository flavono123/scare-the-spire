import { Badge } from "@/components/ui/badge";
import { SpireIcon, type SpireIconColor } from "@/components/spire-icon";
import type { ServiceLocale } from "@/lib/i18n";
import type { PatchType } from "@/lib/types";
import { cn } from "@/lib/utils";

type ChipToken = {
  src: string;
  alt: Record<ServiceLocale, string>;
  variant: SpireIconColor;
  className: string;
};

export const PATCH_TYPE_TOKENS: Record<PatchType, ChipToken> = {
  release: {
    src: "/images/sts2/powers/genesis_power.webp",
    alt: { ko: "창세", en: "Genesis" },
    variant: "green",
    className: "bg-green-500/15 text-green-400 border-green-500/30",
  },
  beta: {
    src: "/images/sts2/powers/entropy_power.webp",
    alt: { ko: "엔트로피", en: "Entropy" },
    variant: "blue",
    className: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  },
  stable: {
    src: "/images/sts2/powers/artifact_power.webp",
    alt: { ko: "인공물", en: "Artifact" },
    variant: "green",
    className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  },
  hotfix: {
    src: "/images/sts2/powers/hotfix_power.webp",
    alt: { ko: "핫픽스", en: "Hotfix" },
    variant: "orange",
    className: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  },
};

export const PATCH_BALANCE_TOKEN: ChipToken = {
  src: "/images/sts2/powers/imbalanced_power.webp",
  alt: { ko: "불균형", en: "Imbalanced" },
  variant: "gold",
  className: "bg-primary/15 text-primary border-primary/30",
};

const CHIP_BADGE_CLASS = "overflow-visible";

function ChipIcon({
  token,
  serviceLocale,
  muted,
}: {
  token: ChipToken;
  serviceLocale: ServiceLocale;
  muted?: boolean;
}) {
  return (
    <SpireIcon
      src={token.src}
      label={token.alt[serviceLocale]}
      size={12}
      variant={token.variant}
      className={cn(muted && "opacity-55")}
    />
  );
}

export function PatchTypeChip({
  type,
  label,
  serviceLocale,
  muted = false,
  className,
}: {
  type: PatchType;
  label: string;
  serviceLocale: ServiceLocale;
  muted?: boolean;
  className?: string;
}) {
  const token = PATCH_TYPE_TOKENS[type];

  return (
    <Badge
      variant="outline"
      data-patch-chip="type"
      className={cn(!muted && token.className, CHIP_BADGE_CLASS, className)}
    >
      <ChipIcon token={token} serviceLocale={serviceLocale} muted={muted} />
      {label}
    </Badge>
  );
}

export function PatchBalanceChip({
  label,
  serviceLocale,
  muted = false,
  className,
}: {
  label: string;
  serviceLocale: ServiceLocale;
  muted?: boolean;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      data-patch-chip="balance"
      className={cn(!muted && PATCH_BALANCE_TOKEN.className, CHIP_BADGE_CLASS, className)}
    >
      <ChipIcon token={PATCH_BALANCE_TOKEN} serviceLocale={serviceLocale} muted={muted} />
      {label}
    </Badge>
  );
}
