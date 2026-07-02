export type CompendiumResourceLinkType =
  | "affliction"
  | "ancient"
  | "card"
  | "character"
  | "enchantment"
  | "encounter"
  | "epoch"
  | "event"
  | "keyword"
  | "monster"
  | "potion"
  | "power"
  | "relic";

type LinkConfig = {
  path: string;
  param: string;
  search?: Record<string, string>;
};

const COMPENDIUM_RESOURCE_LINKS: Record<CompendiumResourceLinkType, LinkConfig> = {
  affliction: { path: "/compendium/enchantments", param: "affliction" },
  ancient: { path: "/compendium/ancients", param: "ancient" },
  card: { path: "/compendium/cards", param: "card" },
  character: { path: "/compendium/characters", param: "character" },
  enchantment: { path: "/compendium/enchantments", param: "enchantment" },
  encounter: { path: "/compendium/bestiary", param: "encounter", search: { view: "encounters" } },
  epoch: { path: "/compendium/epochs", param: "epoch" },
  event: { path: "/compendium/events", param: "event" },
  keyword: { path: "/compendium/keywords", param: "keyword" },
  monster: { path: "/compendium/bestiary", param: "monster" },
  potion: { path: "/compendium/potions", param: "potion" },
  power: { path: "/compendium/powers", param: "power" },
  relic: { path: "/compendium/relics", param: "relic" },
};

export function buildCompendiumResourceHref(
  type: CompendiumResourceLinkType,
  id: string,
): string {
  const config = COMPENDIUM_RESOURCE_LINKS[type];
  const params = new URLSearchParams(config.search);
  params.set(config.param, id.toLowerCase());
  return `${config.path}?${params.toString()}`;
}
