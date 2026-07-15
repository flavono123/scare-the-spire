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
  detailPath: string;
  param: string;
  search?: Record<string, string>;
};

const COMPENDIUM_RESOURCE_LINKS: Record<CompendiumResourceLinkType, LinkConfig> = {
  affliction: { path: "/compendium/enchantments", detailPath: "/compendium/enchantments", param: "affliction" },
  ancient: { path: "/compendium/ancients", detailPath: "/compendium/ancients", param: "ancient" },
  card: { path: "/compendium/cards", detailPath: "/compendium/cards", param: "card" },
  character: { path: "/compendium/characters", detailPath: "/compendium/characters", param: "character" },
  enchantment: { path: "/compendium/enchantments", detailPath: "/compendium/enchantments", param: "enchantment" },
  encounter: { path: "/compendium/bestiary", detailPath: "/compendium/encounters", param: "encounter", search: { view: "encounters" } },
  epoch: { path: "/compendium/epochs", detailPath: "/compendium/epochs", param: "epoch" },
  event: { path: "/compendium/events", detailPath: "/compendium/events", param: "event" },
  keyword: { path: "/compendium/keywords", detailPath: "/compendium/keywords", param: "keyword" },
  monster: { path: "/compendium/bestiary", detailPath: "/compendium/monsters", param: "monster" },
  potion: { path: "/compendium/potions", detailPath: "/compendium/potions", param: "potion" },
  power: { path: "/compendium/powers", detailPath: "/compendium/powers", param: "power" },
  relic: { path: "/compendium/relics", detailPath: "/compendium/relics", param: "relic" },
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

export function buildCompendiumResourceDetailHref(
  type: CompendiumResourceLinkType,
  id: string,
): string {
  const config = COMPENDIUM_RESOURCE_LINKS[type];
  return `${config.detailPath}/${encodeURIComponent(id.toLowerCase())}`;
}
