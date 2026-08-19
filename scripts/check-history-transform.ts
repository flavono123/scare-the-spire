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

function strikeGroup(deck: ReturnType<typeof buildDeckAtFloor>) {
  return deck.filter((entry) => entry.id === "CARD.STRIKE_REGENT");
}

function particleWalls(deck: ReturnType<typeof buildDeckAtFloor>) {
  return deck.filter((entry) => entry.id === "CARD.PARTICLE_WALL");
}

const particleWallRaw = JSON.stringify({
  seed: "8JJDFVNCCG5Y",
  build_id: "v0.110.1",
  ascension: 10,
  game_mode: "standard",
  win: false,
  acts: ["ACT.OVERGROWTH"],
  players: [
    {
      id: 1,
      character: "CHARACTER.REGENT",
      deck: [
        {
          id: "CARD.STRIKE_REGENT",
          floor_added_to_deck: 1,
          enchantment: { id: "ENCHANTMENT.TEZCATARAS_EMBER", amount: 1 },
        },
        {
          id: "CARD.STRIKE_REGENT",
          floor_added_to_deck: 1,
          enchantment: { id: "ENCHANTMENT.TEZCATARAS_EMBER", amount: 1 },
        },
        {
          id: "CARD.STRIKE_REGENT",
          floor_added_to_deck: 1,
          enchantment: { id: "ENCHANTMENT.TEZCATARAS_EMBER", amount: 1 },
        },
        {
          id: "CARD.STRIKE_REGENT",
          floor_added_to_deck: 1,
          enchantment: { id: "ENCHANTMENT.TEZCATARAS_EMBER", amount: 1 },
        },
        { id: "CARD.FALLING_STAR", floor_added_to_deck: 1 },
        { id: "CARD.VENERATE", floor_added_to_deck: 1, current_upgrade_level: 1 },
        { id: "CARD.ASCENDERS_BANE", floor_added_to_deck: 1 },
        {
          id: "CARD.PARTICLE_WALL",
          floor_added_to_deck: 2,
          enchantment: { id: "ENCHANTMENT.NIMBLE", amount: 2 },
        },
        { id: "CARD.PARTICLE_WALL", floor_added_to_deck: 38 },
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
        player_stats: [{ upgraded_cards: ["CARD.VENERATE"] }],
      },
      {
        map_point_type: "monster",
        rooms: [{ model_id: "ENCOUNTER.CULTISTS_NORMAL", room_type: "monster", turns_taken: 1 }],
        player_stats: [{ cards_gained: [{ id: "CARD.PARTICLE_WALL" }] }],
      },
      {
        map_point_type: "unknown",
        rooms: [{ model_id: "EVENT.SELF_HELP_BOOK", room_type: "event", turns_taken: 0 }],
        player_stats: [
          {
            cards_enchanted: [
              {
                card: {
                  id: "CARD.PARTICLE_WALL",
                  floor_added_to_deck: 2,
                  enchantment: { id: "ENCHANTMENT.NIMBLE", amount: 2 },
                },
                enchantment: "ENCHANTMENT.NIMBLE",
              },
            ],
          },
        ],
      },
      ...Array.from({ length: 14 }, () => ({
        map_point_type: "monster",
        rooms: [{ model_id: "ENCOUNTER.CULTISTS_NORMAL", room_type: "monster", turns_taken: 1 }],
        player_stats: [{}],
      })),
      {
        map_point_type: "ancient",
        rooms: [{ model_id: "EVENT.TEZCATARA", room_type: "event", turns_taken: 0 }],
        player_stats: [
          {
            cards_enchanted: Array.from({ length: 4 }, () => ({
              card: {
                id: "CARD.STRIKE_REGENT",
                floor_added_to_deck: 1,
                enchantment: { id: "ENCHANTMENT.TEZCATARAS_EMBER", amount: 1 },
              },
              enchantment: "ENCHANTMENT.TEZCATARAS_EMBER",
            })),
          },
        ],
      },
      ...Array.from({ length: 19 }, () => ({
        map_point_type: "monster",
        rooms: [{ model_id: "ENCOUNTER.CULTISTS_NORMAL", room_type: "monster", turns_taken: 1 }],
        player_stats: [{}],
      })),
      {
        map_point_type: "shop",
        rooms: [{ model_id: "ROOM.SHOP", room_type: "shop", turns_taken: 0 }],
        player_stats: [{ cards_gained: [{ id: "CARD.PARTICLE_WALL" }] }],
      },
    ],
  ],
});

const particleRun = parseReplayRun(particleWallRaw);

const afterParticleWall = buildDeckAtFloor(particleRun, 3);
const wallsAt3 = particleWalls(afterParticleWall);
const strikesAt3 = strikeGroup(afterParticleWall);
assert.equal(wallsAt3.length, 1, "Particle Wall should be its own group after Nimble");
assert.equal(wallsAt3[0]?.count, 1);
assert.equal(wallsAt3[0]?.enchantmentId, "ENCHANTMENT.NIMBLE");
assert.equal(wallsAt3[0]?.enchantmentAmount, 2);
assert.equal(strikesAt3.length, 1, "unenchanted Strikes group together");
assert.equal(strikesAt3[0]?.count, 4);
assert.equal(strikesAt3[0]?.enchantmentId, undefined, "Strike must not inherit later Ember");

const afterEmber = buildDeckAtFloor(particleRun, 18);
const strikesAt18 = strikeGroup(afterEmber);
assert.equal(strikesAt18.length, 1);
assert.equal(strikesAt18[0]?.count, 4);
assert.equal(strikesAt18[0]?.enchantmentId, "ENCHANTMENT.TEZCATARAS_EMBER");
assert.equal(strikesAt18[0]?.enchantmentAmount, 1);
assert.equal(particleWalls(afterEmber)[0]?.enchantmentId, "ENCHANTMENT.NIMBLE");

const end = buildDeckAtFloor(particleRun, 38);
const wallsAtEnd = particleWalls(end);
assert.equal(wallsAtEnd.length, 2, "Nimble and unenchanted Particle Walls must not merge");
assert.equal(wallsAtEnd[0]?.enchantmentId, "ENCHANTMENT.NIMBLE");
assert.equal(wallsAtEnd[0]?.count, 1);
assert.equal(wallsAtEnd[1]?.enchantmentId, undefined);
assert.equal(wallsAtEnd[1]?.count, 1);
assert.equal(strikeGroup(end)[0]?.count, 4);

console.log("history deck enchantment grouping: ok");
