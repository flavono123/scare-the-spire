import registryPayload from "../data/place-registry.json";

// Kept apart from place-registry.ts so the Worker bundle reads the paths
// without pulling in label messages.
type RoutePlace = { href: string; exactRoute?: boolean };

/** Path segments of index pages and places the Worker serves at their exact path. */
export function exactRoutePlaceSegments(
  places: readonly RoutePlace[] = registryPayload.places,
  indexPages: readonly string[] = registryPayload.indexPages,
): string[][] {
  return [...indexPages, ...places.filter((place) => place.exactRoute).map((place) => place.href)]
    .map((href) => href.split("/").filter(Boolean));
}
