# Scare the Spire

Slay the Spire 2 patch and game data reference service. This context captures the product language used to describe game-derived browsing surfaces and content.

## Language

**백과사전**:
The Korean service term for the game **Compendium** and the canonical name for the STS2 reference area.
_Avoid_: Codex, 도감 as the generic top-level name

**Compendium**:
The original game term that localizes to **백과사전**.
_Avoid_: Codex

**카드 도서관**:
The in-game menu under the **백과사전** for browsing cards.
_Avoid_: 카드 라이브러리, card library in user-facing text

**도감**:
A user colloquialism for the **백과사전**, used canonically only when the game itself names a specific menu that way.
_Avoid_: using 도감 as the generic top-level product term

## Relationships

- **Compendium** and **백과사전** are the same concept in different languages.
- **카드 도서관** is one menu inside the **백과사전**.
- **도감** may refer to the **백과사전** colloquially, but is not the canonical generic term.

## Example dialogue

> **Dev:** "Should this page title say Codex or 도감?"
> **Domain expert:** "No. The canonical product term is **백과사전** because it is the Korean localization of **Compendium**."

## Flagged ambiguities

- "Codex" was used as both a code namespace and a user-facing service term - resolved: new product language should use **백과사전** or the exact in-game menu name instead.
