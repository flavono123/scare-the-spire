"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavAttentionDot } from "@/components/nav-attention-dot";
import Image from "@/components/ui/static-image";
import { useNavSeen } from "@/hooks/use-nav-seen";
import {
  localizeHrefWithGameLocale,
  type GameLocale,
  type ServiceLocale,
} from "@/lib/i18n";
import { serviceMessages } from "@/messages/service";

export function PatchSectionTabs({
  active,
  serviceLocale,
  gameLocale,
}: {
  active: "notes" | "changes" | "neowsletters";
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
}) {
  const pathname = usePathname();
  const navSeen = useNavSeen(pathname ?? "/patches");
  const copy = serviceMessages[serviceLocale].patchChanges.tabs;
  const items = [
    {
      id: "notes" as const,
      label: copy.notes,
      href: "/patches",
      icon: "/images/sts2/nav/patch_notes_icon.png",
      attentionId: "patch-notes",
    },
    {
      id: "changes" as const,
      label: copy.changes,
      href: "/patches/changes",
      icon: "/images/sts2/relics/bookmark.webp",
      attentionId: null,
    },
    {
      id: "neowsletters" as const,
      label: copy.neowsletters,
      href: "/patches/neowsletters",
      icon: "/images/sts2/ancients/neow.webp",
      attentionId: "neowsletters",
    },
  ];

  return (
    <nav className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-white/10" aria-label={copy.notes}>
      {items.map((item) => {
        const selected = item.id === active;
        return (
          <Link
            key={item.id}
            href={localizeHrefWithGameLocale(item.href, serviceLocale, gameLocale)}
            prefetch={false}
            aria-current={selected ? "page" : undefined}
            className={`relative inline-flex items-center gap-2 pb-2 font-game-title text-sm transition-colors ${
              selected ? "text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Image src={item.icon} alt="" width={24} height={24} className="h-6 w-6 shrink-0 object-contain" />
            <span>{item.label}</span>
            {item.attentionId && (
              <NavAttentionDot
                placement="trail"
                marker={item.attentionId}
                dormant={!navSeen.unreadIds.includes(item.attentionId)}
              />
            )}
            {selected && <span className="absolute inset-x-0 -bottom-px h-px bg-primary" />}
          </Link>
        );
      })}
    </nav>
  );
}
