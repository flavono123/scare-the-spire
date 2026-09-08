/** Event ids that have extracted `/generated/event-vfx/scenes/{id}.json` stages. */
export const HISTORY_EVENT_VFX_IDS = new Set([
  "ABYSSAL_BATHS",
  "BUGSLAYER",
  "BYRDONIS_NEST",
  "COLORFUL_PHILOSOPHERS",
  "COLOSSAL_FLOWER",
  "CRYSTAL_SPHERE",
  "DENSE_VEGETATION",
  "DOLL_ROOM",
  "DOORS_OF_LIGHT_AND_DARK",
  "DROWNING_BEACON",
  "ENDLESS_CONVEYOR",
  "GRAVE_OF_THE_FORGOTTEN",
  "HUNGRY_FOR_MUSHROOMS",
  "INFESTED_AUTOMATON",
  "LOST_WISP",
  "MORPHIC_GROVE",
  "POTION_COURIER",
  "PUNCH_OFF",
  "RANWID_THE_ELDER",
  "RELIC_TRADER",
  "SELF_HELP_BOOK",
  "SPIRALING_WHIRLPOOL",
  "SUNKEN_TREASURY",
  "SYMBIOTE",
  "TABLET_OF_TRUTH",
  "TEA_MASTER",
  "THE_FUTURE_OF_POTIONS",
  "THE_LEGENDS_WERE_TRUE",
  "THIS_OR_THAT",
  "TRIAL",
  "UNREST_SITE",
  "WAR_HISTORIAN_REPY",
  "WATERLOGGED_SCRIPTORIUM",
  "WHISPERING_HOLLOW",
]);

export function historyEventVfxSlug(eventId: string | undefined): string | null {
  if (!eventId || !HISTORY_EVENT_VFX_IDS.has(eventId)) return null;
  return eventId.toLowerCase();
}
