/**
 * Party / multiplayer History Course helpers.
 *   pnpm exec tsx scripts/history-party.selfcheck.ts
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  mergePartyBadges,
  partyDuplicateOrdinals,
  focusedMapAct,
} from "../src/lib/history-party";
import {
  COVER_PARTY_DIAGONAL_DEG,
  coverPartyClipPath,
  coverPartySlicePolygon,
} from "../src/lib/run-cover-character-frame";
import { computeRunHash } from "../src/lib/sts2-run-hash";
import {
  analyzeReplayRun,
  historyEntryForPlayer,
  parseReplayRun,
  type ReplayRun,
} from "../src/lib/sts2-run-replay";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function historyDir(): string {
  return join(
    homedir(),
    "Library/Application Support/SlayTheSpire2/steam/76561199168753671/profile1/saves/history",
  );
}

function loadRun(filename: string): ReplayRun {
  return parseReplayRun(readFileSync(join(historyDir(), filename), "utf8"));
}

async function main() {
  assert(
    JSON.stringify(partyDuplicateOrdinals(["A", "B", "C"])) ===
      JSON.stringify([null, null, null]),
    "unique characters have no ordinals",
  );
  assert(
    JSON.stringify(
      partyDuplicateOrdinals([
        "CHARACTER.NECROBINDER",
        "CHARACTER.DEFECT",
        "CHARACTER.NECROBINDER",
        "CHARACTER.IRONCLAD",
      ]),
    ) === JSON.stringify([1, null, 2, null]),
    "duplicate necro ordinals are 1-based among that character",
  );
  assert(COVER_PARTY_DIAGONAL_DEG === 60, "party cover diagonal is 60°");
  for (const n of [2, 3, 4]) {
    const innerSlants: number[] = [];
    for (let i = 0; i < n; i++) {
      const p = coverPartySlicePolygon(i, n);
      const clip = coverPartyClipPath(i, n);
      assert(clip.includes("% 0%") && clip.includes("% 100%"), `slot ${i}/${n} is full height`);
      const leftmost = i === 0;
      const rightmost = i === n - 1;
      if (leftmost) {
        assert(p.topLeft === 0 && p.bottomLeft === 0, `${n}P left edge is open`);
        assert(p.topRight > p.bottomRight, `${n}P leftmost still crops the right`);
        innerSlants.push(p.topRight - p.bottomRight);
      } else if (rightmost) {
        assert(p.topRight === 100 && p.bottomRight === 100, `${n}P right edge is open`);
        assert(p.topLeft > p.bottomLeft, `${n}P rightmost still crops the left`);
        innerSlants.push(p.topLeft - p.bottomLeft);
      } else {
        assert(p.topLeft > p.bottomLeft, `slot ${i}/${n} TR→BL left edge`);
        assert(p.topRight > p.bottomRight, `slot ${i}/${n} TR→BL right edge`);
        const leftSlant = p.topLeft - p.bottomLeft;
        const rightSlant = p.topRight - p.bottomRight;
        assert(
          Math.abs(leftSlant - rightSlant) < 0.01,
          `slot ${i}/${n} is a parallelogram`,
        );
        innerSlants.push(leftSlant);
      }
      if (i > 0) {
        const prev = coverPartySlicePolygon(i - 1, n);
        assert(prev.topRight > p.topLeft, `slots ${i - 1} and ${i} overlap`);
      }
    }
    assert(
      innerSlants.every((slant) => Math.abs(slant - innerSlants[0]!) < 0.01),
      `${n}P inner edges share the same diagonal`,
    );
  }

  const mp = loadRun("1783139400.run");
  assert(mp.players.length === 4, "4P fixture player count");
  assert(
    mp.players.map((player) => player.character).join(",") ===
      "CHARACTER.NECROBINDER,CHARACTER.DEFECT,CHARACTER.NECROBINDER,CHARACTER.IRONCLAD",
    "4P character order",
  );
  const floorWithStats = mp.map_point_history.flat().find(
    (entry) => (entry.player_stats?.length ?? 0) === 4,
  );
  assert(floorWithStats, "4P floor has four player_stats");
  assert(historyEntryForPlayer(floorWithStats!, 0) === floorWithStats, "p0 is identity");
  const p0Hp = floorWithStats!.current_hp;
  const p3 = historyEntryForPlayer(floorWithStats!, 3);
  assert(p3.current_hp !== undefined, "p3 overlay has hp");
  if (typeof p0Hp === "number" && typeof p3.current_hp === "number") {
    assert(
      p3.playerId === mp.players[3]?.id || p3.current_hp !== p0Hp,
      "focused overlay does not keep host-only stats",
    );
  }

  const merged = mergePartyBadges(mp);
  const ids = merged.map((badge) => badge.id.replace(/^[A-Z]+\./, "").toUpperCase());
  assert(ids.length === new Set(ids).size, "merged badges unique by id");

  const hostOnly: ReplayRun = { ...mp, players: [mp.players[0]!] };
  assert(
    (await computeRunHash(mp)) !== (await computeRunHash(hostOnly)),
    "MP hash includes every character",
  );

  const sp = loadRun("1785153542.run");
  assert(sp.players.length === 1, "SP fixture");
  const spClone: ReplayRun = { ...sp, players: [{ ...sp.players[0]! }] };
  assert(
    (await computeRunHash(sp)) === (await computeRunHash(spClone)),
    "SP hash is stable",
  );

  const bootsAnalysis = analyzeReplayRun(sp);
  const bootsAct = bootsAnalysis.acts.find((act) => act.flightArrivalNodeIds.length > 0);
  if (bootsAct) {
    const overlay = focusedMapAct(bootsAct, sp, 0);
    assert(
      overlay.flightArrivalNodeIds.join(",") === bootsAct.flightArrivalNodeIds.join(","),
      "SP winged-boots overlays stay visible for player 0",
    );
  }

  const spoils = loadRun("1782043953.run");
  const spoilsAct = analyzeReplayRun(spoils).acts.find((act) => act.spoilsMarkerNodeId);
  assert(spoilsAct, "SP spoils act-2 fixture has a marker");
  assert(
    focusedMapAct(spoilsAct!, spoils, 0).spoilsMarkerNodeId === spoilsAct!.spoilsMarkerNodeId,
    "SP spoils marker stays visible for player 0 after quest card removal",
  );

  const fur = loadRun("1786259679.run");
  const furAct = analyzeReplayRun(fur).acts.find((act) => act.furCoatMarkerNodeIds.length > 0);
  if (furAct) {
    assert(
      focusedMapAct(furAct, fur, 0).furCoatMarkerNodeIds.join(",") ===
        furAct.furCoatMarkerNodeIds.join(","),
      "SP fur coat markers stay on player 0",
    );
  }

  console.log("ok", {
    mpPlayers: mp.players.length,
    mpHashChanged: true,
    spSeed: sp.seed,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
