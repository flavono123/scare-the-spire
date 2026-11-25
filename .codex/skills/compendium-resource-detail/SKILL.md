---
name: compendium-resource-detail
description: Build or refactor STS2 백과사전/Compendium resource detail and modal UIs, related-resource rails (관련 리소스) and reciprocal cross references, from the relic detail pattern. Use when extending card, relic, potion, power, enchantment, event, monster, encounter or ancient details; adding related resources, comments, patch history or GameHoverTip previews; or connecting resources to each other.
---

# Compendium Resource Detail

Reference implementation: `src/components/codex/relic-detail.tsx` (+ `relic-library.tsx`, `relic-tile.tsx`). Language: `CONTEXT.md`, `docs/DESIGN.md`, `docs/adr/0001-gradual-codex-deprecation.md`.

## Detail

- One detail component serves both the list modal (URL query state such as `?relic=...`) and the direct `/compendium/...` route; they are the same 상세 보기, not two depths.
- Desktop: game resource stage left, information rail right. Mobile stacks the same content; no mobile-only features.
- Keep resource-specific controls (card upgrade, enchantment, event choices, monster moves, skins); don't flatten them into a generic detail.
- UI words: 백과사전/Compendium, 카드, 유물, 포션, 파워, 인챈트, 이벤트, 몬스터, 관련 리소스. Never new user-facing `Codex`, `도감`, `entity`.

## Hover tips

- `GameHoverTip` holds only the official game name and effect: no English canonical name, rarity, id or service metadata. Service info goes in the rail.
- Keyword and related-link hovers render resource asset + `GameHoverTip` (`EntityPreview`), never the old opaque web tooltip. Cards use `CardTile`.
- Keep previews inside the viewport (right-edge resources open left, low ones open up).

## Rail

- The info rail is always visible, untitled, not collapsible; metadata pills show values only (`희귀`, not `희귀도`).
- 관련 리소스: always visible when non-empty, one compact line per kind (`관련 이벤트: ...`), `EntityReferenceLinks` / `EntityReferenceGroupLinks` (`src/components/codex/entity-reference-links.tsx`).
- 패치 이력 and 댓글 default open; the comments title shows `(n)` when n > 0 (`CommentSection` `onCountChange`).
- Patch history: `STS2ChangeHistory` with `getSTS2Changes()` (and `getEntityVersionDiffs()`, derived from `fieldDiffs`, when the resource needs version reconstruction). Only structured changes to this resource, never mere mentions. Links are `/patches/{version}` without `v`. Monsters accept old `enemy` change types.

## Cross references

- Prefer derived game data (encounter monster lists, ancient relic ownership, `data/sts2/code-relations.json` from `pnpm codex:relations`) over curated maps. Curated relations live only in `src/lib/codex-references.ts` (`EVENT_RELATED_*_IDS`, special mechanics beside their constants).
- One source map plus inverse helpers (e.g. `getRelatedEventIdsForCard`), never two maps. Canonical uppercase ids, compared case-insensitively only at lookup.
- New related kind: extend `CodexReferenceKind` / `REFERENCE_KIND_CONFIG`, thread data through both the modal and direct route, and build targets with `id`, `/compendium/...` href, localized title and `EntityInfo`.
- Check the reciprocal page shows the relation too.

## Verify

`pnpm lint`, `pnpm codex:validate-references` (both endpoint ids exist), then browser checks of the modal, the direct route, an edge hover and a keyword hover, and `$mobile-viewport-qa` on each changed route.
