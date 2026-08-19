import assert from "node:assert/strict";
import { buildDeckAtFloor } from "../src/components/history-course/topbar-state";
import { parseReplayRun } from "../src/lib/sts2-run-replay";

const raw = JSON.stringify({
  seed: "PYPJUG1UN6",
  build_id: "v0.107.1",
  ascension: 9,
  game_mode: "standard",
  win: true,
  acts: ["ACT.OVERGROWTH"],
  players: [
    {
      id: 1,
      character: "CHARACTER.IRONCLAD",
      deck: [
        { id: "CARD.STRIKE_IRONCLAD", floor_added_to_deck: 1 },
        { id: "CARD.BASH", floor_added_to_deck: 1 },
        { id: "CARD.HELLRAISER", floor_added_to_deck: 6, current_upgrade_level: 1 },
        { id: "CARD.DRUM_OF_BATTLE", floor_added_to_deck: 6 },
      ],
      relics: [],
      potions: [],
      badges: [],
    },
  ],
  modifiers: [],
  map_point_history: [
    [
      {
        map_point_type: "ancient",
        rooms: [{ model_id: "EVENT.NEOW", room_type: "event", turns_taken: 0 }],
        player_stats: [
          {
            cards_gained: [
              { id: "CARD.STRIKE_IRONCLAD" },
              { id: "CARD.DEFEND_IRONCLAD" },
            ],
          },
        ],
      },
      {
        map_point_type: "monster",
        rooms: [{ model_id: "ENCOUNTER.CULTISTS_NORMAL", room_type: "monster", turns_taken: 1 }],
        player_stats: [{}],
      },
      {
        map_point_type: "monster",
        rooms: [{ model_id: "ENCOUNTER.CULTISTS_NORMAL", room_type: "monster", turns_taken: 1 }],
        player_stats: [{}],
      },
      {
        map_point_type: "monster",
        rooms: [{ model_id: "ENCOUNTER.CULTISTS_NORMAL", room_type: "monster", turns_taken: 1 }],
        player_stats: [{}],
      },
      {
        map_point_type: "monster",
        rooms: [{ model_id: "ENCOUNTER.CULTISTS_NORMAL", room_type: "monster", turns_taken: 1 }],
        player_stats: [{}],
      },
      {
        map_point_type: "unknown",
        rooms: [{ model_id: "EVENT.MORPHIC_GROVE", room_type: "event", turns_taken: 0 }],
        player_stats: [
          {
            cards_transformed: [
              {
                original_card: { id: "CARD.STRIKE_IRONCLAD", floor_added_to_deck: 1 },
                final_card: { id: "CARD.DRUM_OF_BATTLE", floor_added_to_deck: 6 },
              },
              {
                original_card: { id: "CARD.DEFEND_IRONCLAD", floor_added_to_deck: 1 },
                final_card: { id: "CARD.HELLRAISER", floor_added_to_deck: 6 },
              },
            ],
          },
        ],
      },
    ],
  ],
});

const run = parseReplayRun(raw);
assert.equal(run.map_point_history[0][5]?.cards_transformed?.length, 2);
assert.equal(
  run.map_point_history[0][5]?.cards_transformed?.[1]?.final.id,
  "CARD.HELLRAISER",
);

const before = buildDeckAtFloor(run, 5);
assert.equal(
  before.some((entry) => entry.id === "CARD.HELLRAISER"),
  false,
  "Hellraiser must not appear before the Morphic Grove floor",
);

const after = buildDeckAtFloor(run, 6);
const hellraiser = after.find((entry) => entry.id === "CARD.HELLRAISER");
assert.ok(hellraiser, "Hellraiser from cards_transformed must appear in the deck");
assert.equal(hellraiser.count, 1);
assert.equal(hellraiser.firstFloor, 6);

console.log("history transform cards: ok");
