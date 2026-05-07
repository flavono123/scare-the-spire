# Codex Filter and Search Refactor

Date: 2026-05-07

## Goal

Unify Codex library filtering and search primitives before mobile optimization work.
This is a refactor-first task: drawer scroll locking, touch target tuning, and broader
mobile layout changes stay separate unless a shared primitive needs a safe default.

## Scope

- Pull the repeated left filter panel structure into a shared Codex drawer/shell.
- Pull search token definitions, parsing, chip validation, and fuzzy text matching into shared code.
- Keep per-library filtering rules data-driven, because cards, relics, potions, powers,
  enchantments, monsters, encounters, and events do not expose identical filter domains.
- Use the card library as the reference implementation because it already has the richest
  filter/sort/search behavior.
- Replace page-local search bars in potions, monsters, and encounters with the shared search UI.
- Preserve Korean-first UI copy and game-localized names.

## Token Semantics

The trigger character describes a conceptual filter area. A library may omit a trigger when
the concept does not exist.

- `@`: character-like ownership/category only.
  - Cards: characters plus colorless/event/curse/status/ancient buckets.
  - Potions: characters plus shared/event buckets.
  - Relics: current source/pool usage should be reconsidered; if kept, use the same card-library
    character token assets, not character select portraits.
  - Events: must not use `@` for act filters.
- `#`: card/combat type.
  - Cards, enchantments, powers, monsters, and encounters use this for type-like filters.
- `!`: rarity by default.
  - Relics and potions should move rarity here so `#` remains type-like across the Codex.
- `$` or `%`: reserved for extra low-frequency filters.
  - Cards may keep cost here if rarity moves to `!`, or keep cost on `!` if rarity is not exposed
    in search for that library.
  - Events should use a reserved non-`@` trigger for acts if act token search remains useful.

Open choice after the first migration: whether card cost remains `!` and rarity stays sidebar-only,
or rarity becomes `!` everywhere and card cost moves to `$`.

## Mobile Search Considerations

- Token hint buttons must be tappable, because mobile symbol keyboard switching makes raw
  `@#!$%` entry slow.
- The shared search bar should keep `inputMode="search"`, disable autocapitalize/autocorrect,
  and show token chips so accidental invalid tokens are visible.
- Search dropdowns and hint panels must not be hover-only.

## Patch Note Tooltip Follow-Up

Rich patch notes currently expose entity previews through hover and link navigation through click.
On mobile, hover does not translate cleanly to touch, so tapping an entity tends to navigate
without first revealing the preview. Treat this as a separate mobile UX task after the filter/search
refactor.

Planned direction:

- Detect coarse pointers and remove hover-only assumptions for rich patch entities.
- Use first tap to open a compact preview/action popover, with an explicit link action inside it.
- Keep desktop hover behavior unchanged.
- Add Playwright mobile tests for rich patch notes that verify a tap does not accidentally navigate
  when the preview affordance should be shown first.

## Refactor Order

1. Add shared drawer/search primitives without migrating behavior.
2. Migrate cards as the reference implementation.
3. Migrate relics and potions, including shared card-library character token assets.
4. Migrate powers and enchantments.
5. Migrate monsters and encounters.
6. Update events so act filters no longer use `@`.
7. Add focused tests for drawer behavior and token parsing.
