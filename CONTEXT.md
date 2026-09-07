# Scare the Spire

Slay the Spire 1 and 2 patch and game data reference service. This context captures the product language used to describe game-derived browsing surfaces and content.

## Language

**백과사전**:
The Korean service term for the game **Compendium**. It is game-scoped: both Slay the Spire and Slay the Spire 2 have a 백과사전. The STS2 reference area is canonical at `/compendium`; the STS1 reference area is `/compendium/sts1`.
_Avoid_: Codex, 도감 as the generic top-level name

**Compendium**:
The original game term that localizes to **백과사전**.
_Avoid_: Codex

**카드 도서관**:
The STS2 in-game menu under the **백과사전** for browsing cards.
_Avoid_: 카드 라이브러리, card library in user-facing text, and using this name for STS1

**카드 모음집**:
The STS1 in-game menu for browsing cards (`MenuPanels` TEXT[9]). Child menus of the STS1 백과사전 also include **유물 모음집** and **포션 연구실**.
_Avoid_: 카드 도서관 for STS1 surfaces

**도감**:
A user colloquialism for the **백과사전**, used canonically only when the game itself names a specific menu that way.
_Avoid_: using 도감 as the generic top-level product term

**관련 리소스**:
A game item or game-derived page connected to the current resource through patch notes, hover links, or reverse references.
_Avoid_: 관련 엔티티, entity

**상세 보기**:
The shared detail UI for a card, relic, potion, or other resource, whether opened from a list or loaded by direct URL.
_Avoid_: 상세 표면

## Relationships

- **Compendium** and **백과사전** are the same concept in different languages.
- Each game has its own **백과사전**. STS2 child menus use STS2 locale names such as **카드 도서관**. STS1 child menus use STS1 locale names: **카드 모음집**, **유물 모음집**, **포션 연구실**.
- **도감** may refer to the **백과사전** colloquially, but is not the canonical generic term.
- A **관련 리소스** links one **백과사전** resource to another without introducing the generic term "entity."
- A **상세 보기** can appear as a modal from a list or as a direct URL view without becoming a separate navigation depth.

## Example dialogue

> **Dev:** "Should this page title say Codex or 도감?"
> **Domain expert:** "No. The canonical product term is **백과사전** because it is the Korean localization of **Compendium**."

> **Dev:** "Should the STS1 card index say 카드 도서관?"
> **Domain expert:** "No. STS1 uses the game menu **카드 모음집**. **카드 도서관** is the STS2 menu."

## Flagged ambiguities

- "Codex" was used as both a code namespace and a user-facing service term - resolved: new product language should use **백과사전** or the exact in-game menu name instead.
- "entity" was used as a generic label for cards, relics, potions, events, and similar items - resolved: use **관련 리소스** for cross-reference surfaces and direct names like card or relic elsewhere.
- "상세 표면" was used for the modal/page shared detail UI - resolved: use **상세 보기**.
- "카드 도서관" was used as if it named every game's card browser - resolved: STS2 only; STS1 is **카드 모음집**.
