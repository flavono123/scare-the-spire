# Isolated STS1 Compendium Rendering

STS1 cards, relics, and potions are a one-time extract from the latest desktop jar, rendered through an isolated data and UI stack so they can be referenced from posts without sharing STS2 parsers, tiles, or Compendium JSON.

Canonical URLs live under `/compendium/sts1/{cards|relics|potions}`. `/cards`, `/relics`, and `/potions` remain as a grace-period alias. `/compendium/sts2/...` aliases the existing STS2 `/compendium/...` tree. The thin Worker and Next rewrites map those aliases onto one prerendered asset set; OpenNext must not emit a second `/cards` HTML tree.
