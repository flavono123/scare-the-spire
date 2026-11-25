---
name: create-toybox-service
description: Choose and implement game-backed identities (title, functional subtitle, hero phrase, token, background, default nickname) for new or retitled scare-the-spire Toy Box services. Use when the user asks to create, build or add a Toy Box service, or for recommendations on any of those fields. Accept complete, partial or absent inputs; verify given values and resolve missing ones from the codebase, extracted game data and assets, PCK or DLL without guessing.
---

# Create Toy Box Service

Read [references/source-discovery.md](references/source-discovery.md). Before
changing code, read `$feature-implementation`. Read `$update-game-assets` only
when extracted sources leave a gap and you need the PCK or DLL.

Split the request into the behavior, the identity fields the user gave, and
whether they want recommendations or an implementation. Keep given choices
unless game evidence, availability or a project rule contradicts them; verify
them instead of assuming they are game text. Resolve missing fields yourself.
Ask only when the behavior itself is ambiguous. Recommendations change no code
and offer two or three coherent sets with one pick, ranked by semantic fit,
evidence, ko/en support, availability, token legibility and crop quality; a
creation request picks one set and builds it unless the user asked to approve
first.

## Identity (one coherent set)

| Field | Rule |
| --- | --- |
| Title | Korean first. Exact game-localized name when one names the service, else honest service wordplay. `h1`, menu, OG title `{title} - {brand}`. |
| Functional subtitle | Service-owned verb phrase, never a game line. Metadata and OG/Twitter description: `슬레이 더 스파이어 2 {기능 설명} - 슬서운 이야기` / `Slay the Spire 2 {function} - Scare the Spire`. The visible `h2` is only `{기능 설명}`. Existing phrases: `src/messages/service.ts`. |
| Hero phrase | Optional exact or minimally adapted game line, a muted `<p>` under the `h2`. Page only. Omit rather than invent. |
| Token | Small icon-like art (relic, potion, power, badge, Ancient) legible in the menu and header. Never a card portrait (card art may be the background or OG image). Its meaning must not collide with any other use site-wide. |
| Background | Card, event or scene art for the service action that survives `ServiceBackground` and mobile crops. |
| Default nickname | When the service posts: exact or minimally adapted game identity noun, at most 20 characters, in `src/messages/service.ts` as the `useUserProfile` fallback (empty profile is common). No invented `익명의 ~` labels; Chemical X's is the documented exception. |

The hero phrase is never `Metadata.description`, OG/Twitter or any SEO
description: it would read as the borrowed resource's description. Record every
adapted phrase (source table, key, original, replacement rule) in
`data/i18n/borrowed-game-phrases.json`; generate runtime copy at build time,
never in a Worker request.

## Implement

- Reuse current patterns (newest full example: `src/app/pagestorm/`). Thin
  `page.tsx`, shared `page-content.tsx`, header via `ToyBoxIndexHeading`, index
  OG description via `composeToyBoxIndexOgDescription` in
  `src/lib/service-metadata.ts`. Outline: `h1` title, `h2` subtitle, hero `<p>`;
  the create CTA sits on the title row.
- Add the menu entry to `src/data/place-registry.json` (`area: "toybox"`, token,
  art, label, `createdAt` = ship date; menus sort newest first). A community
  service gets `parent: "defragment"` unless the user places it elsewhere, and
  joins `DEFRAGMENT_FEDERATED_SERVICES` / `DEFRAGMENT_WRITE_SERVICES` in
  `src/lib/defragment.ts` when it has posts. A tab of another service uses that
  parent plus `menuHidden: true` (이아저? 월드컵 under `this-or-that`); its
  byrdispatch NEW lights the parent row (`src/lib/site-nav-items.ts`).
- Public record URLs ship the `__id__` shell, including the federated
  `/defragment/{service}/{id}` one, in the same change (`AGENTS.md`,
  `$feature-implementation`).

## Verify and report

- Every game-derived claim has a precise source; every asset path exists or is
  marked pending extraction. You looked at the token at menu/header size and the
  background on desktop and mobile.
- Search the final token across the repo: every use is the same concept or
  non-conflicting.
- Grep metadata code: OG description is the subtitle template, not the hero.
  Check `ko` and `en` copy in the dictionaries and generated output.
- Run what `$qa` selects. Report the identity table with each field's status
  (provided / exact / adapted / related / service-owned) and source, the registry
  entry, and the shell smoke result for record routes.
