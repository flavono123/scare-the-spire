/**
 * Map icon names (files under public/images/sts2/map) for a room type, and
 * for a visited "?" by the room it turned out to be. Shared by the history
 * course map parts and the map progress bar simulator.
 */

import type { ReplayMapPointType } from "@/lib/sts2-run-replay";

export function mapIconNameForType(type: ReplayMapPointType) {
  switch (type) {
    case "monster":
      return "map_monster";
    case "elite":
      return "map_elite";
    case "rest_site":
      return "map_rest";
    case "treasure":
      return "map_chest";
    case "shop":
      return "map_shop";
    case "unknown":
      return "map_unknown";
    default:
      return null;
  }
}

export function mapOutlineNameForType(type: ReplayMapPointType) {
  switch (type) {
    case "monster":
      return "map_monster_outline";
    case "elite":
      return "map_elite_outline";
    case "rest_site":
      return "map_rest_outline";
    case "treasure":
      return "map_chest_outline";
    case "shop":
      return "map_shop_outline";
    case "unknown":
      return "map_unknown_outline";
    default:
      return null;
  }
}

/** Icon a visited "?" shows for the room it turned out to be (lowercase room type). */
export function revealedUnknownIconNameForRoom(roomType: string | undefined) {
  switch (roomType) {
    case "monster":
      return "map_unknown_monster";
    case "elite":
      return "map_unknown_elite";
    case "shop":
      return "map_unknown_shop";
    case "treasure":
      return "map_unknown_chest";
    default:
      return "map_unknown";
  }
}

export function revealedUnknownOutlineNameForRoom(roomType: string | undefined) {
  switch (roomType) {
    case "monster":
      return "map_monster_outline";
    case "elite":
      return "map_elite_outline";
    case "shop":
      return "map_shop_outline";
    case "treasure":
      return "map_chest_outline";
    default:
      return "map_unknown_outline";
  }
}
