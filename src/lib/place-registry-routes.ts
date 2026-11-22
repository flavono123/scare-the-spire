import registryPayload from "../data/place-registry.json";

// Kept apart from place-registry.ts so the Worker bundle reads the paths
// without pulling in label messages.
type RoutePlace = { href: string; exactRoute?: boolean };

/** Path segments of places the Worker serves at their exact path. */
export function exactRoutePlaceSegments(
  places: readonly RoutePlace[] = registryPayload.places,
): string[][] {
  return places
    .filter((place) => place.exactRoute)
    .map((place) => place.href.split("/").filter(Boolean));
}
