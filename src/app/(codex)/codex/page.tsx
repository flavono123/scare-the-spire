import Image from "@/components/ui/static-image";
import Link from "next/link";
import {
  getGameLocaleFromSearchRecord,
  getServiceLocaleFromSearchRecord,
  localizeHrefWithGameLocale,
} from "@/lib/i18n";
import {
  formatCodexCount,
  getCodexServiceMessages,
} from "@/lib/codex-service";

const categories = [
  {
    href: "/codex/cards",
    labelKey: "cards",
    count: 612,
    description: null,
    images: [
      "/images/sts2/cards/bash.webp",
      "/images/sts2/cards/backstab.webp",
      "/images/sts2/cards/ball_lightning.webp",
      "/images/sts2/cards/apparition.webp",
    ],
  },
  {
    href: "/codex/relics",
    labelKey: "relics",
    count: 314,
    description: null,
    images: [
      "/images/sts2/relics/akabeko.webp",
      "/images/sts2/relics/anchor.webp",
      "/images/sts2/relics/amethyst_aubergine.webp",
      "/images/sts2/relics/amphorae.webp",
    ],
  },
  {
    href: "/codex/potions",
    labelKey: "potions",
    count: 63,
    description: null,
    images: [
      "/images/sts2/potions/attack_potion.webp",
      "/images/sts2/potions/block_potion.webp",
      "/images/sts2/potions/ashwater.webp",
      "/images/sts2/potions/beetle_juice.webp",
    ],
  },
  {
    href: "/codex/powers",
    labelKey: "powers",
    count: 238,
    description: null,
    images: [
      "/images/sts2/powers/strength_power.webp",
      "/images/sts2/powers/vulnerable_power.webp",
      "/images/sts2/powers/demon_form_power.webp",
      "/images/sts2/powers/poison_power.webp",
    ],
  },
  {
    href: "/codex/enchantments",
    labelKey: "enchantments",
    count: 22,
    description: null,
    images: [
      "/images/sts2/enchantments/sharp.webp",
      "/images/sts2/enchantments/favored.webp",
      "/images/sts2/enchantments/swift.webp",
      "/images/sts2/enchantments/steady.webp",
    ],
  },
  {
    href: "/codex/monsters",
    labelKey: "monsters",
    count: 111,
    description: null,
    images: [
      "/images/sts2/bosses/ceremonial_beast_boss.webp",
      "/images/sts2/bosses/knowledge_demon_boss.webp",
      "/images/sts2/bosses/queen_boss.webp",
      "/images/sts2/bosses/vantom_boss.webp",
    ],
  },
  {
    href: "/codex/events",
    labelKey: "events",
    count: 57,
    description: null,
    images: [
      "/images/sts2/events/abyssal_baths.webp",
      "/images/sts2/events/doll_room.webp",
      "/images/sts2/events/crystal_sphere.webp",
      "/images/sts2/events/trial.webp",
    ],
  },
  {
    href: "/codex/encounters",
    labelKey: "encounters",
    count: 89,
    description: null,
    images: [
      "/images/sts2/nav/stats_monsters.png",
      "/images/sts2/nav/happy_cultist.png",
      "/images/sts2/bosses/queen_boss.webp",
      "/images/sts2/bosses/vantom_boss.webp",
    ],
  },
  {
    href: "/codex/ancients",
    labelKey: "ancients",
    count: 8,
    description: null,
    images: [
      "/images/sts2/ancients/neow.webp",
      "/images/sts2/ancients/orobas.webp",
      "/images/sts2/ancients/pael.webp",
      "/images/sts2/ancients/darv.webp",
    ],
  },
] as const;

export default async function CodexIndexPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolvedSearchParams);
  const gameLocale = getGameLocaleFromSearchRecord(resolvedSearchParams);
  const messages = getCodexServiceMessages(serviceLocale);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-yellow-900/30 bg-[#0d0d14]">
        <div className="mx-auto max-w-5xl px-6 py-12 text-center">
          <h1 className="font-[family-name:var(--font-gc-batang)] text-4xl md:text-5xl text-yellow-500 mb-3">
            {messages.indexView.title}
          </h1>
          <p className="font-[family-name:var(--font-gc-batang)] text-lg text-yellow-200/60">
            {messages.indexView.subtitle}
          </p>
        </div>
      </div>

      {/* Category Grid */}
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {categories.map((cat) => (
            <Link
              key={cat.href}
              href={localizeHrefWithGameLocale(cat.href, serviceLocale, gameLocale)}
              className="group relative overflow-hidden rounded-xl border border-yellow-900/20 bg-[#12121a] hover:border-yellow-700/40 hover:bg-[#16161f] transition-all duration-200"
            >
              {/* Thumbnail row */}
              <div className="flex items-center justify-center gap-3 px-6 pt-6 pb-4">
                {cat.images.map((src, i) => (
                  <div
                    key={i}
                    className="relative w-14 h-14 md:w-16 md:h-16 opacity-70 group-hover:opacity-100 transition-opacity duration-200"
                  >
                    <Image
                      src={src}
                      alt=""
                      fill
                      sizes="64px"
                      className="object-contain drop-shadow-[0_0_8px_rgba(255,215,0,0.15)]"
                    />
                  </div>
                ))}
              </div>

              {/* Text */}
              <div className="px-6 pb-6 text-center">
                <h2 className="font-[family-name:var(--font-gc-batang)] text-2xl text-yellow-400 group-hover:text-yellow-300 transition-colors">
                  {messages[cat.labelKey]}
                  {serviceLocale === "ko" && (
                    <span className="ml-2 text-base text-yellow-200/30 font-[family-name:var(--font-kreon)]">
                      {ENGLISH_LABELS[cat.labelKey]}
                    </span>
                  )}
                </h2>
                {cat.description && (
                  <p className="mt-1 text-sm text-yellow-200/40 font-[family-name:var(--font-gc-batang)]">
                    {cat.description}
                  </p>
                )}
                <span className="mt-2 inline-block text-xs text-yellow-600/60 font-[family-name:var(--font-kreon)]">
                  {formatCodexCount(cat.count, messages.labels.entries, serviceLocale)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

const ENGLISH_LABELS: Record<(typeof categories)[number]["labelKey"], string> = {
  cards: "Cards",
  relics: "Relics",
  potions: "Potions",
  powers: "Powers",
  enchantments: "Enchantments",
  monsters: "Monsters",
  events: "Events",
  encounters: "Encounters",
  ancients: "Ancients",
};
