---
name: compendium-resource-detail
description: Build or refactor STS2 백과사전/Compendium resource detail and modal UIs from the finalized relic detail pattern. Use when extending card, relic, potion, power, enchantment, event, monster, encounter, or ancient detail views; when adding related resources, comments, patch history, or GameHoverTip previews; or when aligning existing Codex-named components with the Compendium design rules.
---

# Compendium Resource Detail

Use this skill to extend the current relic detail/modal implementation to other STS2 백과사전 resources without re-opening the product/design decisions.

## Read First

Read only the files needed for the target resource.

- Product language: `CONTEXT.md`
- Design rules: `docs/DESIGN.md`
- Naming ADR: `docs/adr/0001-gradual-codex-deprecation.md`
- Relic reference implementation: `src/components/codex/relic-detail.tsx`, `src/components/codex/relic-library.tsx`, `src/components/codex/relic-tile.tsx`
- Shared UI/data helpers: `src/components/codex/hover-tip.tsx`, `src/components/codex/entity-reference-links.tsx`, `src/components/codex/sts2-change-history.tsx`, `src/components/patch-note-renderer.tsx`
- Data loaders and version diffs: `src/lib/data.ts`, `src/lib/entity-versioning.ts`
- Mobile QA hook: `.codex/skills/mobile-viewport-qa/SKILL.md`

## Product Language

- Use **백과사전** / **Compendium** as product language.
- Do not introduce new user-facing `Codex`, `도감`, or `entity` wording.
- Use direct resource nouns in UI copy: 카드, 유물, 포션, 파워, 인챈트, 이벤트, 몬스터.
- Use **관련 리소스** for cross-resource links.
- Treat modal and direct URL as the same **상세 보기**, not separate navigation depths.

## Detail Pattern

Use `src/components/codex/relic-detail.tsx` as the current source pattern.

- One detail component must serve both list modal and direct route.
- List pages open the detail as a modal and keep URL query state (`?relic=...`, `?potion=...`, etc.).
- Direct routes render the same detail component without adding a second UX depth.
- Desktop layout: main game resource stage left, information rail right.
- Mobile layout: stack the same content; do not create a separate mobile-only feature set.
- Main stage should feel like the game resource floats on the background, not like a web card inside another card.
- Additional service information belongs in the rail, not in the game hover tip.

## Game Hover Tip Rules

- Use `GameHoverTip` for non-card resource name/effect presentation.
- `GameHoverTip` content should contain the official game name and game effect/description only.
- Do not put English canonical names, rarity/source labels, internal IDs, or service metadata inside the main game hover tip.
- For patch-note and related-resource keyword hover, render **resource asset + GameHoverTip**, not the old opaque web tooltip.
- Cards can continue to use `CardTile` as the preview body.
- Event previews use a larger background crop next to a compact `GameHoverTip`; the tip should shrink to title width when no body text is needed.
- Keep tooltip placement inside the viewport. Right-edge resources should show previews to the left; low resources should prefer upward placement.

## Rail Rules

- The metadata/info rail itself is always visible, has no "정보" title, and has no collapse button.
- Metadata pills show values only. For example, show `이벤트`, `공용`, `희귀`; do not show labels like `희귀도` or `이벤트`.
- Related resources are always visible when present and should use one compact line per kind, e.g. `관련 이벤트: ...`.
- Other rails such as 패치 이력 and 댓글 default to open if they are collapsible.
- Comments title must show the count as `(n)` when count is greater than zero. Use `CommentSection` `onCountChange` where available.

## Patch History Rules

- Use `STS2ChangeHistory` for structured STS2 history.
- Pass both curated `STS2Change[]` from `getSTS2Changes()` and machine-applicable `EntityVersionDiff[]` from `getEntityVersionDiffs()` when available.
- Show actual structured changes for the current resource only. Do not mix in patch-note mentions that merely name the resource.
- Patch history links must use `/patches/{version}` without a leading `v` in the route, even when displayed labels include `v0.105.0`.
- For monsters, accept both `monster` and old patch-note `enemy` change types when needed.

## Implementation Checklist

1. Inspect the existing target detail, library/list, direct route, and data loader files.
2. Compare against the relic detail pattern before editing.
3. Add missing props for `patches`, `changes`, `versionDiffs`, `entities`, and related resources only where the target needs them.
4. Keep existing resource-specific gameplay controls; do not flatten card upgrade, enchantment, event-choice, monster-move, or skin controls into a generic detail abstraction.
5. Replace old web hover cards with `EntityPreview`/`GameHoverTip` behavior where the resource appears as a keyword or related link.
6. Preserve existing user changes and unrelated dirty files.
7. Commit immediately after each meaningful edit, matching `AGENTS.md`.

## Verification

Run narrow checks first:

```bash
pnpm lint
```

Run a build when changing server routes, data loading, shared components, or type contracts:

```bash
pnpm build
```

For visual changes, use browser/Playwright smoke checks on:

- The target list modal.
- The direct `/compendium/.../[id]` route.
- A right-edge or bottom-edge hover target.
- A patch-note or related-resource keyword hover.

Then run `$mobile-viewport-qa` as the final layout hook for every changed list/detail route that has mobile-visible UI. Use stable route-specific selectors when available; otherwise use `main` with a non-matching controls selector as documented in `.codex/skills/mobile-viewport-qa/SKILL.md`.
