---
name: compendium-cross-references
description: Add or refactor STS2 백과사전/Compendium cross-resource references and related-resource rails. Use when connecting cards, relics, potions, events, monsters, encounters, ancients, powers, or enchantments to other resources; when adding "관련 리소스" rail rows; when making relationships reciprocal; or when replacing ad hoc related-link UI with the shared EntityReferenceLinks/GameHoverTip preview pattern.
---

# Compendium Cross References

Use this skill to add related-resource rails and reciprocal links between STS2 백과사전 resources without rediscovering the cross-reference pattern.

## Read First

Read only the files needed for the target resource.

- Detail design skill: `.codex/skills/compendium-resource-detail/SKILL.md`
- Relationship helpers: `src/lib/codex-references.ts`
- Shared rail UI: `src/components/codex/entity-reference-links.tsx`
- Hover preview implementation: `src/components/patch-note-renderer.tsx`
- Current examples: `src/components/codex/relic-detail.tsx`, `src/components/codex/card-detail.tsx`, `src/components/codex/event-detail.tsx`, `src/components/codex/monster-detail.tsx`, `src/components/codex/encounter-detail.tsx`, `src/components/codex/ancient-detail.tsx`
- Data loaders for the resources being connected: `src/lib/codex-data.ts` and the relevant `src/app/(codex)/codex/.../page.tsx` route files.
- Mobile QA hook: `.codex/skills/mobile-viewport-qa/SKILL.md`

## Language And Placement

- Use **관련 리소스** as the concept and direct nouns in row labels: `관련 카드`, `관련 유물`, `관련 이벤트`, `관련 몬스터`.
- Do not introduce user-facing `Codex`, `도감`, or `entity` wording.
- Put related resources in the information rail, not inside the game hover tip.
- The related rail is always visible when non-empty. Do not add a collapse control for it.
- Use one compact line per resource kind. When multiple kinds are present, use `EntityReferenceGroupLinks`.

## Relationship Rules

Prefer derived or extracted game data before curated maps.

- Encounters and monsters: derive from encounter monster lists; expose inverse links rather than duplicate manual tables.
- Ancients and relics: derive from ancient relic ownership/event data.
- Events and cards/relics/potions: use `EVENT_RELATED_*_IDS` in `src/lib/codex-references.ts` only for relationships not already represented in structured extracted data.
- Special event mechanics such as Tinker Time and Future of Potions belong in `src/lib/codex-references.ts` beside their constants and filters.
- Store IDs in canonical game form. Preserve uppercase IDs in curated maps and compare case-insensitively only at lookup boundaries.
- A relationship should normally be reciprocal. Prefer one source map plus inverse helpers such as `getRelatedEventIdsForCard` over maintaining two divergent maps.

When adding a new related kind:

1. Extend `CodexReferenceKind` and `REFERENCE_KIND_CONFIG` in `entity-reference-links.tsx`.
2. Add or derive relationship helpers in `codex-references.ts`.
3. Pass the target resource data through both the list modal path and direct `[id]` route.
4. Build `CodexReferenceTarget` objects with `id`, `/compendium/...` href, localized title, and `EntityInfo` metadata when available.
5. Render with `EntityReferenceLinks` or `EntityReferenceGroupLinks` in the rail.

## Target Construction Pattern

Use existing entity data to populate previews. Do not emit bare text links unless no entity metadata exists.

```tsx
const relatedEventTargets = getRelatedEventIdsForRelic(relic.id).map((eventId) => {
  const event = relatedEvents.find((candidate) => candidate.id === eventId);
  return {
    id: eventId,
    href: `/compendium/events/${eventId.toLowerCase()}`,
    title: event?.name ?? eventId,
    entity: event ? entities?.find((candidate) => candidate.id === event.id) : undefined,
  };
});
```

`EntityPreview` must show the resource asset plus game-style hover tip. Do not regress to the old opaque web tooltip. Keep direct links localizable via `localizeHref`, which `EntityReferenceLinks` already applies.

## Implementation Checklist

1. Identify the relationship source: extracted game data, existing curated map, or a new curated relation.
2. Verify both endpoint IDs exist in the current localized data.
3. Add one canonical relationship source and inverse lookup helpers where useful.
4. Thread required resource arrays and `entities` through list pages, modal detail props, and direct route props.
5. Render the rail in the detail component with shared reference components.
6. Check the reciprocal detail page also shows the relation or has a clear reason not to.
7. Preserve unrelated dirty files and commit after each meaningful edit.

## Verification

Run narrow checks:

```bash
pnpm lint
```

Run a build when changing route data loading, shared reference components, or type contracts:

```bash
pnpm build
```

Use browser/Playwright smoke checks for visual or interaction changes:

- Source detail modal and direct `/compendium/.../[id]` route.
- Target detail page showing the reciprocal relation.
- Hovering a related resource link near a viewport edge.
- A grouped rail with multiple related kinds when the resource has one.

Finish visual or interaction work by running `$mobile-viewport-qa` on each changed source/target route. This catches related-resource rails, hover previews, and modal/detail layout regressions that only appear in the repository mobile presets.
