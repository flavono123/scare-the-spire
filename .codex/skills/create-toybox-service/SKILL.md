---
name: create-toybox-service
description: Choose and implement game-backed identities for new scare-the-spire Toy Box services. Use when the user asks to create, build, or add a Toy Box service, or asks for recommendations for any combination of its title, gameLocale page subtitle, token asset, and background art. Accept complete, partial, or absent identity inputs; verify provided values and resolve missing ones from the codebase, extracted game data and assets, PCK, or DLL without guessing.
---

# Create Toy Box Service

Establish a coherent game-backed service identity, then either recommend it or
carry it through implementation.

## Required context

1. Read [references/source-discovery.md](references/source-discovery.md).
2. Before changing service code, read
   `.codex/skills/feature-implementation/SKILL.md` and follow its companion-skill
   routing, including Cloudflare guardrails.
3. Read `.codex/skills/update-game-assets/SKILL.md` before inspecting raw PCK or
   DLL sources or extracting an asset.

Do not load the raw-game workflow when tracked extraction output fully proves
the choice.

## Interpret the request

Split the request into:

- The service behavior or user problem.
- Any provided title, page subtitle, token asset, and background art.
- Whether the user wants recommendations only or an implemented service.

Preserve provided identity choices unless they conflict with game evidence,
technical availability, or an explicit project invariant. Verify them rather
than silently treating them as game-authentic. Resolve every missing identity
field without asking the user merely to fill the template.

If the service behavior itself is materially ambiguous, ask about that behavior
after exhausting repository context. Do not invent product behavior just
because identity fields may be omitted.

For recommendation-only requests, inspect and report without modifying service
code. For creation requests, select the best-supported identity and implement
the service unless the user explicitly asks to approve the identity first.

## Identity contract

Resolve these identity fields as one set. If the service has a public composer
that posts a nickname, also resolve `defaultNickname` from the same identity.

| Field | Requirement |
| --- | --- |
| Title | Use Korean first. Prefer exact game-localized naming when a resource naturally names the service; otherwise label deliberate service-owned wordplay honestly. |
| Page subtitle | Use an exact `gameLocale` line or a minimal documented transformation of one. Render it only inside the service page. |
| Token asset | Use a same-name or semantically tight in-game token that remains legible in navigation and the page header. Keep its meaning distinct across the entire site, not only among Toy Box services. |
| Background art | Use related card, event, or scene art that expresses the service action and survives desktop and mobile cropping. |
| Default nickname | Required when the service posts a nickname. Use an exact in-game identity noun or a minimal documented adaptation of one (Combo `융합자` / `Amalgamator` from `AMALGAMATOR.title`; Transfigure `변형체` / `Transfigured` from `TRANSFIGURE.title`). Do not invent `익명의 ~술사` labels. Chemical X `익명의 투입터리안` is the documented service-owned exception. Keep ≤ 20 characters. This remains the real fallback when `sts-user-profile` is missing; profile character nicknames are not auto-seeded on service pages. |

Never use the page subtitle as `Metadata.description`, Open Graph description,
Twitter description, or another SEO description. It can be mistaken for the
description of the game resource from which it was borrowed. Write a separate,
factual service-owned metadata description.

Store an adapted game phrase's source table, key, original text, and replacement
rule in `data/i18n/borrowed-game-phrases.json`. Generate localized runtime copy
through the existing static generation flow. Never perform localization-table,
PCK, or DLL searches inside a Worker request.

## Resolve the identity

1. Search repository implementations, localization, structured game resources,
   and tracked assets in the order defined by the source-discovery reference.
2. Escalate to current local PCK or DLL evidence only when extracted sources
   leave a real gap.
3. Before choosing a token, search its asset path, resource id, imports, and
   visually or semantically equivalent symbols across all site surfaces. Include
   Toy Box and non-Toy-Box services, global navigation, page headers, profiles,
   comments, and aggregate views. Reject a duplicate when separate features
   would compete for the same symbol or interfere with each other's meaning.
   Reuse is acceptable only when every appearance intentionally represents the
   same feature or concept.
4. Inspect actual candidate images. Do not select token or background art from
   filename semantics alone.
5. Rank coherent sets by semantic fit, source evidence, cross-locale support,
   existing asset availability, token legibility, and background crop quality.
6. For recommendations, offer two or three coherent sets with one clear
   recommendation. For direct creation, choose one set.
7. Record for each field whether it was provided, exact game text/art, adapted
   game text, or a related game resource, plus its precise source.

Do not weaken an exact title/token pairing merely to force novelty. Do not claim
that two resources are related unless structured data, PCK scenes, or DLL code
supports the relationship.

## Implement a selected service

Follow current Toy Box patterns instead of copying one old route wholesale:

- Keep base and `[gameLocale]` route entry files thin and share rendering and
  metadata through the adjacent `page-content.tsx`.
- Add the service to `getToyBoxNavItems` with the chosen token and localized
  title.
- Put service-owned UI text in the typed service dictionaries. Put exact or
  adapted game copy in the generated `gameLocale` path.
- If the service posts a nickname, set `defaultNickname` in
  `src/messages/service.ts` from the same game-locale identity and pass it as
  the `useUserProfile` fallback. See `$feature-implementation` service default
  nicknames.
- Reuse the chosen token in the page header and render the chosen background
  with `ServiceBackground`; use the repository static-image/cache-busting
  conventions.
- Add route metadata, OG image rules, search/crawl surfaces, and detail-route
  variants when the service shape requires them.
- Keep the page subtitle separate from metadata. An OG image may use the
  selected background art, but its description must remain service-owned.
- Preserve the sole `StorageUnavailableNotice` rule for public storage failure
  UI.
- Keep all source discovery, localization transformation, image extraction, and
  indexing at authoring or build time under Cloudflare Free constraints.

Respect the repository rule to explain and obtain approval before broad route
moves or many-file mechanical changes. Commit immediately after every meaningful
edit as required by `AGENTS.md`.

## Verify

For recommendations:

- Confirm every game-derived claim against a precise source.
- Confirm every asset path exists or clearly mark extraction as pending.
- Report the site-wide token collision check and exclude candidates whose reuse
  would make distinct services or features interfere with each other's meaning.
- State explicitly that the page subtitle is excluded from metadata.

For implementations:

1. Search metadata code to prove that the page subtitle was not reused as an
   SEO description.
2. Run the checks selected by `$qa` for the touched scope.
3. Search the final token across the repository and confirm that every existing
   use is either the same concept or non-conflicting.
4. Inspect the token at navigation/header sizes and the background on desktop
   and repository mobile presets.
5. Verify localized title and subtitle fallbacks from generated output, not
   only Korean source text.
6. Report the identity table (title, subtitle, token, background, and
   `defaultNickname` when the service posts), exact sources, metadata
   description, Cloudflare guardrail result, and verification performed.
