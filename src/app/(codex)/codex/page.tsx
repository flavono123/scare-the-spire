import Image from "next/image";
import Link from "next/link";

const categories = [
  {
    href: "/codex/cards",
    label: "카드",
    labelEn: "Cards",
    count: 612,
    description: "모든 캐릭터의 공격, 스킬, 파워 카드",
    images: [
      "/images/spire-codex/cards/bash.png",
      "/images/spire-codex/cards/backstab.png",
      "/images/spire-codex/cards/ball_lightning.png",
      "/images/spire-codex/cards/apparition.png",
    ],
  },
  {
    href: "/codex/relics",
    label: "유물",
    labelEn: "Relics",
    count: 314,
    description: "일반, 상점, 보스, 이벤트 유물",
    images: [
      "/images/spire-codex/relics/akabeko.png",
      "/images/spire-codex/relics/anchor.png",
      "/images/spire-codex/relics/amethyst_aubergine.png",
      "/images/spire-codex/relics/amphorae.png",
    ],
  },
  {
    href: "/codex/potions",
    label: "포션",
    labelEn: "Potions",
    count: 63,
    description: "전투 중 사용하는 소비 아이템",
    images: [
      "/images/spire-codex/potions/attack_potion.png",
      "/images/spire-codex/potions/block_potion.png",
      "/images/spire-codex/potions/ashwater.png",
      "/images/spire-codex/potions/beetle_juice.png",
    ],
  },
  {
    href: "/codex/ancients",
    label: "에인션트",
    labelEn: "Ancients",
    count: 8,
    description: "첨탑을 지배하는 고대 존재들",
    images: [
      "/images/spire-codex/ancients/neow.png",
      "/images/spire-codex/ancients/orobas.png",
      "/images/spire-codex/ancients/pael.png",
      "/images/spire-codex/ancients/darv.png",
    ],
  },
];

export default function CodexIndexPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Header */}
      <div className="border-b border-yellow-900/30 bg-[#0d0d14]">
        <div className="mx-auto max-w-5xl px-6 py-12 text-center">
          <h1 className="font-[family-name:var(--font-spectral)] text-4xl md:text-5xl text-yellow-500 mb-3">
            Spire Codex
          </h1>
          <p className="font-[family-name:var(--font-gc-batang)] text-lg text-yellow-200/60">
            슬레이 더 스파이어 2 백과사전
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
                <h2 className="font-[family-name:var(--font-spectral)] text-2xl text-yellow-400 group-hover:text-yellow-300 transition-colors">
                  {cat.label}
                  <span className="ml-2 text-base text-yellow-200/30 font-[family-name:var(--font-kreon)]">
                    {cat.labelEn}
                  </span>
                </h2>
                <p className="mt-1 text-sm text-yellow-200/40 font-[family-name:var(--font-gc-batang)]">
                  {cat.description}
                </p>
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
