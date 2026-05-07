import type { GameLocale } from "@/lib/i18n";

type CodexNavGameLabelKey =
  | "cards"
  | "relics"
  | "potions"
  | "powers"
  | "monsters"
  | "events"
  | "ancients"
  | "historyCourse";

// Exact client-safe labels from STS2 localization tables:
// main_menu_ui, gameplay_ui, static_hover_tips, epochs.
const CODEX_NAV_GAME_LABELS: Record<GameLocale, Record<CodexNavGameLabelKey, string>> = {
  deu: {
    cards: "Kartenbibliothek",
    relics: "Reliktsammlung",
    potions: "Tranklabor",
    powers: "Macht",
    monsters: "Bestiarium",
    events: "Ereignis",
    ancients: "Ahnen",
    historyCourse: "Geschichtskurs",
  },
  eng: {
    cards: "Card Library",
    relics: "Relic Collection",
    potions: "Potion Lab",
    powers: "Power",
    monsters: "Bestiary",
    events: "Event",
    ancients: "Ancients",
    historyCourse: "History Course",
  },
  esp: {
    cards: "Colección de cartas",
    relics: "Relicario",
    potions: "Pocionero",
    powers: "Poder",
    monsters: "Bestiario",
    events: "Evento",
    ancients: "Ancestrales",
    historyCourse: "Clase de historia",
  },
  fra: {
    cards: "Bibliothèque",
    relics: "Reliquaire",
    potions: "Laboratoire",
    powers: "Pouvoir",
    monsters: "Bestiaire",
    events: "Événement",
    ancients: "Les Anciens",
    historyCourse: "Manuel d'Histoire",
  },
  ita: {
    cards: "Collezione delle carte",
    relics: "Reliquiario",
    potions: "Laboratorio delle pozioni",
    powers: "Potere",
    monsters: "Bestiario",
    events: "Evento",
    ancients: "Gli Antichi",
    historyCourse: "Corso di Storia",
  },
  jpn: {
    cards: "カードライブラリ",
    relics: "レリック一覧",
    potions: "ポーションラボ",
    powers: "パワー",
    monsters: "モンスター図鑑",
    events: "イベント",
    ancients: "エンシェント",
    historyCourse: "歴史学教程",
  },
  kor: {
    cards: "카드 목록",
    relics: "유물 모음집",
    potions: "포션 연구실",
    powers: "파워",
    monsters: "몬스터 도감",
    events: "이벤트",
    ancients: "고대의 존재",
    historyCourse: "역사 강의서",
  },
  pol: {
    cards: "Kolekcja kart",
    relics: "Zbiór Artefaktów",
    potions: "Laboratorium Mikstur",
    powers: "Moc",
    monsters: "Bestiariusz",
    events: "Wydarzenie",
    ancients: "Starożytni",
    historyCourse: "Podręcznik do historii",
  },
  ptb: {
    cards: "Biblioteca de Cartas",
    relics: "Coleção de Relíquias",
    potions: "Laboratório de Poções",
    powers: "Poder",
    monsters: "Bestiário",
    events: "Evento",
    ancients: "Ancestrais",
    historyCourse: "Estudos de História",
  },
  rus: {
    cards: "Библиотека карт",
    relics: "Коллекция реликвий",
    potions: "Лаборатория",
    powers: "Талант",
    monsters: "Бестиарий",
    events: "Событие",
    ancients: "Древние",
    historyCourse: "Лекция по истории",
  },
  spa: {
    cards: "Biblioteca de cartas",
    relics: "Colección de reliquias",
    potions: "Laboratorio de pociones",
    powers: "Poder",
    monsters: "Bestiario",
    events: "Evento",
    ancients: "Los Antiguos",
    historyCourse: "Libro de historia",
  },
  tha: {
    cards: "คลังการ์ด",
    relics: "คลังเครื่องราง",
    potions: "ห้องทดลองยา",
    powers: "พลัง",
    monsters: "คลังอสูร",
    events: "เหตุการณ์",
    ancients: "เทพโบราณ",
    historyCourse: "หลักสูตรประวัติศาสตร์",
  },
  tur: {
    cards: "Kart Kütüphanesi",
    relics: "Kalıntı Koleksiyonu",
    potions: "İksir Laboratuvarı",
    powers: "Güç",
    monsters: "Yaratık Ansiklopedisi",
    events: "Etkinlik",
    ancients: "Kadimler",
    historyCourse: "Tarih Dersi",
  },
  zhs: {
    cards: "卡牌总览",
    relics: "遗物收集",
    potions: "药水研究所",
    powers: "能力",
    monsters: "怪物图鉴",
    events: "事件",
    ancients: "先古之民",
    historyCourse: "历史课",
  },
};

export function getCodexNavGameLabel(
  gameLocale: GameLocale,
  key: string,
): string | undefined {
  return CODEX_NAV_GAME_LABELS[gameLocale][key as CodexNavGameLabelKey];
}
