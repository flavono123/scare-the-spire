import Link from "next/link";
import Image from "@/components/ui/static-image";
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
  active: "notes" | "changes";
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
}) {
  const copy = serviceMessages[serviceLocale].patchChanges.tabs;
  const items = [
    {
      id: "notes" as const,
      label: copy.notes,
      href: "/patches",
      icon: "/images/sts2/nav/patch_notes_icon.png",
    },
    {
      id: "changes" as const,
      label: copy.changes,
      href: "/patches/changes",
      icon: "/images/sts2/ui/topbar/submenu_history_icon.png",
    },
  ];

  return (
    <nav className="mt-4 flex items-center gap-5 border-b border-white/10" aria-label={copy.notes}>
      {items.map((item) => {
        const selected = item.id === active;
        return (
          <Link
            key={item.id}
            href={localizeHrefWithGameLocale(item.href, serviceLocale, gameLocale)}
            prefetch={false}
            aria-current={selected ? "page" : undefined}
            className={`relative inline-flex items-center gap-2 pb-2 font-game-title text-sm transition-colors ${
              selected ? "text-yellow-300" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Image src={item.icon} alt="" width={24} height={24} className="h-6 w-6 object-contain" />
            <span>{item.label}</span>
            {selected && <span className="absolute inset-x-0 -bottom-px h-px bg-yellow-400" />}
          </Link>
        );
      })}
    </nav>
  );
}
