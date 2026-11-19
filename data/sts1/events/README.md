# STS1 event scenes

One JSON file per event class, `<slug>.json`, read by `src/lib/sts1/events.ts`.
Scene graphs are transcribed from the game's bytecode (`javap -c -p` of
`com.megacrit.cardcrawl.events.*`), because the flow lives in `buttonEffect`, not in
data. Text is never copied here: every visible string is a reference into the game's
localization, so all 13 locales render from `data/sts1/localization/<locale>/events.json`.
`scripts/check-sts1-events.ts` validates every file.

```jsonc
{
  "id": "Big Fish",                 // the class's ID constant = events.json key
  "className": "exordium.BigFish",  // under com.megacrit.cardcrawl.events
  "kind": "image",                  // "image" (AbstractImageEvent) | "room" (AbstractEvent + RoomEventDialog)
  "image": "fishing.jpg",           // images/events/<file>; nopants.png (images/npcs) and shrooms.png (bg+fgShrooms)
                                    // are room scenes the extractor writes; null = the list draws the room's monsters
  "start": "intro",
  "vars": {                         // numbers the text shows; tiers by ascension, lowest first
    "heal": [{ "ascension": 0, "value": { "of": "maxHp", "frac": [1, 3] } }],
    "maxHp": [{ "ascension": 0, "value": 5 }]
  },
  "scenes": {
    "intro": {
      "body": [{ "d": 0 }],
      "image": "fishing.jpg",       // optional: only when the scene swaps the art
      "options": [
        {
          "label": [{ "o": 0 }, { "v": "heal" }, { "o": 1 }],
          "next": "banana"
        },
        {
          "label": [{ "o": 4 }],
          "preview": { "type": "card", "id": "Regret" },
          "gains": [{ "type": "relic", "tier": "random" }, { "type": "card", "id": "Regret" }],
          "next": "box"
        }
      ]
    },
    "banana": { "body": [{ "d": 1 }], "options": [{ "label": [{ "o": 5 }], "next": null }] }
  }
}
```

## Text parts

A text is an array of parts concatenated in order, exactly as the game's
`StringBuilder` does, then drawn with the game's smart text (`#y`, `#r`, `NL`, `~wave~`, `@shake@`).

| part | meaning |
|---|---|
| `{ "d": i }` | this event's `DESCRIPTIONS[i]` |
| `{ "o": i }` | this event's `OPTIONS[i]` |
| `{ "ev": "Other ID", "d": i }` / `{ "ev": "Other ID", "o": i }` | another events.json entry's string (shared shrine text etc.) |
| `{ "v": "name" }` | a var, formatted for the selected ascension |
| `{ "card": "Regret" }` / `{ "relic": "Golden Idol" }` / `{ "potion": "..." }` | that item's localized NAME (game ID) |
| `{ "s": " " }` | a literal the code appends (spaces, `"%"`, digits). Never words. |
| `{ "pick": "card" \| "relic" \| "potion", "color"?: "r" }` | the player's own item the code inserts (shown as `???`); `color` when it goes through `FontHelper.colorString` |

## Vars

`value` is one of: a number; `{ "min": a, "max": b }` (inclusive roll);
`{ "of": "maxHp" | "currentHp" | "gold", "pct": 25 }` or `{ "of": ..., "frac": [1, 3] }`
for amounts the game computes from the player (shown as `25%` / `1/3`).
Add an ascension tier only where the code branches on `ascensionLevel`.

## Scenes

`body`, optional `image` (the art swap), `options`, and `bodyVariants` when the code
picks the body by character or by a hidden roll:
`[{ "characters": ["silent", "watcher"], "body": [...] }]` or `[{ "monster": "GremlinNob", "body": [...] }]`.
`body` stays the first variant.

## Options

| field | meaning |
|---|---|
| `label` | text parts |
| `disabled` | the game adds this option already locked (`setDialogOption(msg, true)`) |
| `lockedLabel` | text the game shows instead when a condition fails (gold, deck, HP); keep the enabled one in `label` |
| `preview` | the card or relic the game previews on the button (`setDialogOption(msg, card/relic)`) |
| `next` | the scene the click shows; `null` = the event ends (leave, proceed, map, or combat that ends it) |
| `outcomes` | random branches instead of `next`: `[{ "next": "scene", "chance": 25, "gains"?: [...] }]` (chance in %, when the code fixes it); `"character": "silent"` marks a branch the code takes per character, not a roll |
| `gains` / `loses` | refs the player gets or loses (below) |
| `combat` | `{ "encounters": [["GremlinNob"], ["Sentry", "Sentry", "Sentry"]] }`: one of these monster groups (ids from `data/sts1/monsters.json`) |
| `ascension` | `{ "min": 15 }` / `{ "max": 14 }` when the option only exists at those levels |

Refs: `{ "type": "card" | "relic" | "potion", "id": "GameID" }` for a fixed item,
`{ "type": ..., "pool": ["id", ...] }` for one of a small fixed list,
`{ "type": "card", "pool": "curse" }` for `AbstractDungeon.getCurse()`/random curse,
`{ "type": "relic" | "card" | "potion", "tier": "random" | "common" | "uncommon" | "rare" | "boss" | "colorless" }`
for a generic draw (not drawn as a token). Optional `"upgraded": true`, `"count": n`.

Every `DESCRIPTIONS`/`OPTIONS` index the class uses must appear somewhere; random
results list every possible outcome scene.
