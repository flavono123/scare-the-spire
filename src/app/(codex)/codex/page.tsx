import Image from "@/components/ui/static-image";
import Link from "next/link";

const categories = [
  {
    href: "/codex/cards",
    label: "카드",
    labelEn: "Cards",
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
    label: "유물",
    labelEn: "Relics",
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
    label: "포션",
    labelEn: "Potions",
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
    label: "파워",
    labelEn: "Powers",
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
    label: "인챈트",
    labelEn: "Enchantments",
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
    label: "몬스터",
    labelEn: "Monsters",
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
    label: "이벤트",
    labelEn: "Events",
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
    href: "/codex/ancients",
    label: "에인션트",
    labelEn: "Ancients",
    count: 8,
    description: null,
    images: [
      "/images/sts2/ancients/neow.webp",
      "/images/sts2/ancients/orobas.webp",
      "/images/sts2/ancients/pael.webp",
      "/images/sts2/ancients/darv.webp",
    ],
  },
];

export default function CodexIndexPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-yellow-900/30 bg-[#0d0d14]">
        <div className="mx-auto max-w-5xl px-6 py-12 text-center">
          <h1 className="font-[family-name:var(--font-gc-batang)] text-4xl md:text-5xl text-yellow-500 mb-3">
            백과사전
          </h1>
          <p className="font-[family-name:var(--font-gc-batang)] text-lg text-yellow-200/60">
            슬레이 더 스파이어 2
          </p>
        </div>
      </div>

      {/* Category Grid */}
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {categories.map((cat) => (
            <Link
              key={cat.href}
              href={cat.href}
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
                  {cat.label}
                  <span className="ml-2 text-base text-yellow-200/30 font-[family-name:var(--font-kreon)]">
                    {cat.labelEn}
                  </span>
                </h2>
                {cat.description && (
                  <p className="mt-1 text-sm text-yellow-200/40 font-[family-name:var(--font-gc-batang)]">
                    {cat.description}
                  </p>
                )}
                <span className="mt-2 inline-block text-xs text-yellow-600/60 font-[family-name:var(--font-kreon)]">
                  {cat.count} entries
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
