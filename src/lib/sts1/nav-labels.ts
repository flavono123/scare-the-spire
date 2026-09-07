import type { GameLocale } from "@/lib/i18n";
import { sts1GameLocale } from "./locale";
import type { Sts1GameLocale, Sts1ResourceType } from "./types";

type Sts1NavLabels = Record<Sts1ResourceType, string>;

function flattenNavLabel(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

// Exact MenuPanels titles from STS1 localization:
// cards TEXT[9], relics TEXT[12], potions TEXT[length-2].
const STS1_NAV_LABELS: Record<Sts1GameLocale, Sts1NavLabels> = {
  deu: {
    cards: "Kartenbibliothek",
    relics: "Reliktsammlung",
    potions: "Tranklabor",
  },
  eng: {
    cards: "Card Library",
    relics: "Relic Collection",
    potions: "Potion Lab",
  },
  fra: {
    cards: "Collection de cartes",
    relics: "Collection de Reliques",
    potions: "Laboratoire de potions",
  },
  ita: {
    cards: "Libreria",
    relics: "Reliquiario",
    potions: "Laboratorio Pozioni",
  },
  jpn: {
    cards: "カードライブラリ",
    relics: "レリック コレクション",
    potions: "ポーションラボ",
  },
  kor: {
    cards: "카드 모음집",
    relics: "유물 모음집",
    potions: "포션 연구실",
  },
  pol: {
    cards: "Kartoteka",
    relics: "Artefakty",
    potions: "Mikstury",
  },
  ptb: {
    cards: "Biblioteca de Cartas",
    relics: "Coleção de Relíquias",
    potions: "Laboratório de poções",
  },
  rus: {
    cards: "Библиотека карт",
    relics: "Коллекция реликвий",
    potions: "Алхимическая лаборатория",
  },
  spa: {
    cards: "Biblioteca de Cartas",
    relics: "Colección de Reliquias",
    potions: "Laboratorio de Pociones",
  },
  tha: {
    cards: "คลังการ์ด",
    relics: "คลังเครื่องราง",
    potions: "ห้องทดลองยา",
  },
  tur: {
    cards: "Kart Kütüphanesi",
    relics: "Kalıntı Koleksiyonu",
    potions: "İksir Labı",
  },
  zhs: {
    cards: "卡牌总览",
    relics: "遗物收集",
    potions: "药水研究所",
  },
};

export function getSts1NavLabel(
  gameLocale: GameLocale,
  type: Sts1ResourceType,
): string {
  return flattenNavLabel(STS1_NAV_LABELS[sts1GameLocale(gameLocale)][type]);
}
