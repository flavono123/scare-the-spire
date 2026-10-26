/* eslint-disable @typescript-eslint/no-explicit-any -- walks archived build JSON whose shape varies by version */
import assert from "node:assert/strict";
import fs from "node:fs";
import util from "node:util";
import path from "node:path";
import {
  getVersionedEntity,
  getVersionedEntities,
  resolveVersionedEntity,
} from "../src/lib/versioned-entity-api";
import { normalizeVersionedEntityType } from "../src/lib/codex-versioning";
import { bakeDescription } from "../src/lib/codex-bake";
import { compareVersions, latestPatchVersion, varsForBake } from "../src/lib/entity-versioning";
import { LOCALE_TEXT_PINNED_FROM } from "../src/lib/localization-history";
import { getEnchantStatModifier } from "../src/lib/sts2-enchant-rules";
import type { CodexEnchantment } from "../src/lib/codex-types";
import { updateCompendiumResourceModalUrl } from "../src/lib/compendium-resource-links";
import type { CodexCard } from "../src/lib/codex-types";
import type { EntityVersionDiff, STS2Change, STS2Patch } from "../src/lib/types";

async function runTests() {
  console.log("\n[Monster] structured moves, power amounts, and move graph revert by version");
  {
    const at = (entityId: string, version: string) =>
      getVersionedEntity<Record<string, any> & { id: string }>({ entityType: "monster", entityId, version, locale: "kor" });
    const hissStrength = (e: Record<string, any> | null) =>
      e?.moves.find((m: any) => m.id === "HISS").powerApplications[0].amount;

    const nibbit099 = await at("NIBBIT", "v0.99.0");
    const nibbit100 = await at("NIBBIT", "v0.100.0");
    assert.deepEqual(hissStrength(nibbit099.entity), { normal: 2, ascension: 2 }, "Nibbit Hiss was 2(2) before v0.100.0");
    assert.deepEqual(hissStrength(nibbit100.entity), { normal: 2, ascension: 3 }, "Nibbit Hiss is 2(3) from v0.100.0");

    const forgotten099 = await at("THE_FORGOTTEN", "v0.99.0");
    const forgotten100 = await at("THE_FORGOTTEN", "v0.100.0");
    const forgotten101 = await at("THE_FORGOTTEN", "v0.101.0");
    const miasma = (e: Record<string, any> | null) =>
      e?.moves.find((m: any) => m.id === "MIASMA").powerApplications.find((p: any) => p.amount)?.amount;
    assert.deepEqual(miasma(forgotten099.entity), { normal: 2, ascension: 2 });
    assert.deepEqual(miasma(forgotten100.entity), { normal: 2, ascension: 3 }, "stat steal scaled in v0.100.0");
    assert.deepEqual(miasma(forgotten101.entity), { normal: 2, ascension: 2 }, "scaling removed in v0.101.0");
    assert.deepEqual(forgotten099.entity?.damageValues?.Dread, { normal: 15, ascension: 17 });
    assert.deepEqual(forgotten101.entity?.damageValues?.Dread, { normal: 13, ascension: 15 });

    const colony105 = await at("SKULKING_COLONY", "v0.105.0");
    const colony106 = await at("SKULKING_COLONY", "v0.106.0");
    assert.ok(colony105.entity?.moves.some((m: any) => m.id === "SMASH"), "Smash existed through v0.105.0");
    assert.ok(!colony106.entity?.moves.some((m: any) => m.id === "SMASH"), "Smash removed in v0.106.0");
    assert.equal(colony105.entity?.damageValues?.Smash?.normal, 12);
    assert.equal(colony105.entity?.blockValues?.Zoom?.normal, 10, "Zoom gained Block until v0.106.0");
    assert.equal(colony105.entity?.initialPowerApplications[0].amount.normal, 15, "Hardened Shell 15 before v0.106.0");
    assert.equal(colony106.entity?.initialPowerApplications[0].amount.normal, 20);
    assert.equal(colony105.entity?.moveGraph?.initial, "SMASH", "v0.105.0 graph opens with Smash");

    const colony101 = await at("SKULKING_COLONY", "v0.101.0");
    const colony102 = await at("SKULKING_COLONY", "v0.102.0");
    assert.equal(colony101.entity?.minHp, 74);
    assert.equal(colony101.entity?.damageValues?.Smash?.normal, 9);
    assert.equal(colony102.entity?.damageValues?.Smash?.normal, 12, "Smash 12(13) from v0.102.0");
    assert.equal(colony101.entity?.damageValues?.Inertia, undefined, "Inertia dealt no damage in v0.101.0");
    const colony100 = await at("SKULKING_COLONY", "v0.100.0");
    assert.equal(colony100.entity?.minHp, 74, "HP 74(79) from v0.100.0");
    assert.equal(colony100.entity?.damageValues?.Zoom?.normal, 16, "Zoom 16(17) in v0.100.0, 14(16) from v0.101.0");
    assert.equal(colony101.entity?.damageValues?.Zoom?.normal, 14);
    const colony099 = await at("SKULKING_COLONY", "v0.99.1");
    assert.equal(colony099.entity?.minHp, 79);
    assert.equal(colony099.entity?.initialPowerApplications[0].amount.normal, 20, "Hardened Shell 20 before v0.100.0");
    const door100 = await at("DOORMAKER", "v0.100.0");
    assert.deepEqual(door100.entity?.moves.map((m: any) => m.id), ["DRAMATIC_OPEN", "BEAM", "CHOMP", "PULVERIZE"]);

    const door099 = await at("DOORMAKER", "v0.99.1");
    const door101 = await at("DOORMAKER", "v0.101.0");
    const door102 = await at("DOORMAKER", "v0.102.0");
    const door103 = await at("DOORMAKER", "v0.103.0");
    assert.deepEqual(door099.entity?.moves.map((m: any) => m.id), ["WHAT_IS_IT", "BEAM", "GET_BACK_IN"]);
    assert.equal(door101.entity?.damageValues?.Hunger?.normal, 12);
    assert.equal(door102.entity?.damageValues?.Grasp?.normal, 20, "Grasp attacks for 20(23) in v0.102.0");
    assert.equal(door103.entity?.damageValues?.Hunger?.normal, 30, "Hunger 30(35) from v0.103.0");
  }
  console.log("=== Running Versioned Entity API Spec Tests ===");

  // -------------------------------------------------------------------------
  // 1. Prepared (예비) Rework & Boundary Consistency
  // Spec:
  // - v0.100.0: Prepared reworked (cost 1, discard 2, gain 2 energy, 3 upgraded)
  // - v0.101.0: Prepared rollback (cost 0, draw 1, discard 1)
  // - Boundary < v0.100.0 (e.g. v0.99.0): original (cost 0, draw 1, discard 1)
  // - Boundary >= v0.101.0 (v0.101.0, v0.102.0, v0.111.0): rollback kept
  // -------------------------------------------------------------------------
  console.log("\n[Test 1] PREPARED Card - Target v0.100.0 rework vs boundaries");

  const preparedAt100 = await getVersionedEntity<CodexCard>({
    entityType: "card",
    entityId: "PREPARED",
    version: "v0.100.0",
    locale: "kor",
  });

  assert.equal(preparedAt100.isAvailable, true, "Prepared should be available in v0.100.0");
  assert.equal(preparedAt100.isDeprecated, false, "Prepared should not be deprecated in v0.100.0");
  assert.ok(preparedAt100.entity, "Prepared entity should exist in v0.100.0");
  assert.equal(preparedAt100.entity.cost, 1, "Prepared cost in v0.100.0 must be 1 (reworked)");
  assert.equal(preparedAt100.entity.vars?.Energy, 2, "Prepared vars.Energy in v0.100.0 must be 2");
  assert.equal(preparedAt100.entity.vars?.Cards, 2, "Prepared vars.Cards in v0.100.0 must be 2 (the build's template discards {Cards})");
  assert.ok(
    preparedAt100.entity.description?.includes("[energy:2]"),
    "Prepared description in v0.100.0 must gain 2 energy (the build's own text shows the energy icon)",
  );
  assert.ok(
    preparedAt100.entity.description?.includes("카드를 2장 버립니다"),
    "Prepared description in v0.100.0 must discard 2 cards",
  );

  // Boundary check: v0.99.0 (prior to rework)
  console.log("[Test 1b] PREPARED Card - Boundary v0.99.0 (pre-rework)");
  const preparedAt099 = await getVersionedEntity<CodexCard>({
    entityType: "card",
    entityId: "PREPARED",
    version: "v0.99.0",
    locale: "kor",
  });
  assert.ok(preparedAt099.entity, "Prepared entity should exist in v0.99.0");
  assert.equal(preparedAt099.entity.cost, 0, "Prepared cost in v0.99.0 must be 0 (original)");
  assert.equal(preparedAt099.entity.vars?.Cards, 1, "Prepared vars.Cards in v0.99.0 must be 1");
  assert.equal(preparedAt099.entity.vars?.Energy, undefined, "Prepared vars.Energy in v0.99.0 must not exist");
  assert.ok(
    preparedAt099.entity.description?.includes("카드를 1장 뽑습니다"),
    "Prepared description in v0.99.0 must draw 1 card",
  );
  assert.ok(
    !preparedAt099.entity.description?.includes("에너지"),
    "Prepared description in v0.99.0 must NOT mention energy",
  );

  // Boundary check: v0.101.0 (rollback immediately following rework)
  console.log("[Test 1c] PREPARED Card - Boundary v0.101.0 (post-rollback)");
  const preparedAt101 = await getVersionedEntity<CodexCard>({
    entityType: "card",
    entityId: "PREPARED",
    version: "v0.101.0",
    locale: "kor",
  });
  assert.ok(preparedAt101.entity, "Prepared entity should exist in v0.101.0");
  assert.equal(preparedAt101.entity.cost, 0, "Prepared cost in v0.101.0 must be 0 (rollback)");
  assert.equal(preparedAt101.entity.vars?.Cards, 1, "Prepared vars.Cards in v0.101.0 must be 1");
  assert.equal(preparedAt101.entity.vars?.Energy, undefined, "Prepared vars.Energy in v0.101.0 must not exist");
  assert.ok(
    preparedAt101.entity.description?.includes("카드를 1장 뽑습니다"),
    "Prepared description in v0.101.0 must draw 1 card",
  );
  assert.ok(
    !preparedAt101.entity.description?.includes("에너지"),
    "Prepared description in v0.101.0 must NOT mention energy",
  );

  // Subsequent version checks: v0.102.0 and latest v0.111.0
  console.log("[Test 1d] PREPARED Card - Later versions v0.102.0 and v0.111.0");
  for (const ver of ["v0.102.0", "v0.111.0"]) {
    const res = await getVersionedEntity<CodexCard>({
      entityType: "card",
      entityId: "PREPARED",
      version: ver,
      locale: "kor",
    });
    assert.ok(res.entity, `Prepared entity should exist in ${ver}`);
    assert.equal(res.entity.cost, 0, `Prepared cost in ${ver} must be 0`);
    assert.equal(res.entity.vars?.Cards, 1, `Prepared vars.Cards in ${ver} must be 1`);
    assert.equal(res.entity.vars?.Energy, undefined, `Prepared vars.Energy in ${ver} must not exist`);
  }

  // -------------------------------------------------------------------------
  // 2. Lifecycle availability and deprecation
  // -------------------------------------------------------------------------
  console.log("\n[Test 2] Lifecycle availability (introducedInPatch & deprecated)");

  // NOT_YET card was introduced in v0.103.0
  const notYetBefore = await getVersionedEntity({
    entityType: "card",
    entityId: "NOT_YET",
    version: "v0.102.0",
  });
  assert.equal(notYetBefore.isAvailable, false, "NOT_YET must NOT be available in v0.102.0");
  assert.equal(notYetBefore.entity, null, "NOT_YET entity must be null when unavailable");

  const notYetAtIntro = await getVersionedEntity({
    entityType: "card",
    entityId: "NOT_YET",
    version: "v0.103.0",
  });
  assert.equal(notYetAtIntro.isAvailable, true, "NOT_YET must be available in v0.103.0");
  assert.ok(notYetAtIntro.entity, "NOT_YET entity must exist in v0.103.0");

  // GRAPPLE card was deprecated in v0.103.0
  const grappleBefore = await getVersionedEntity({
    entityType: "card",
    entityId: "GRAPPLE",
    version: "v0.102.0",
  });
  assert.equal(grappleBefore.isDeprecated, false, "GRAPPLE must NOT be deprecated before v0.103.0");

  const grappleAfter = await getVersionedEntity({
    entityType: "card",
    entityId: "GRAPPLE",
    version: "v0.103.0",
  });
  assert.equal(grappleAfter.isDeprecated, true, "GRAPPLE must be deprecated in v0.103.0");

  // SCARE card was deprecated in v0.110.0
  const scareBefore = await getVersionedEntity({
    entityType: "card",
    entityId: "SCARE",
    version: "v0.109.0",
  });
  assert.equal(scareBefore.isDeprecated, false, "SCARE must NOT be deprecated in v0.109.0");

  const scareAfter = await getVersionedEntity({
    entityType: "card",
    entityId: "SCARE",
    version: "v0.110.0",
  });
  assert.equal(scareAfter.isDeprecated, true, "SCARE must be deprecated in v0.110.0");

  // -------------------------------------------------------------------------
  // 3. Relic diff chains & vars preservation
  // PERMAFROST: modified in v0.100.0, reverted in v0.101.0
  // -------------------------------------------------------------------------
  console.log("\n[Test 3] PERMAFROST Relic - Multi-patch diff chain");

  const permafrost100 = await getVersionedEntity({
    entityType: "relic",
    entityId: "PERMAFROST",
    version: "v0.100.0",
    locale: "kor",
  });
  assert.ok(permafrost100.entity, "PERMAFROST should exist in v0.100.0");

  const permafrost101 = await getVersionedEntity({
    entityType: "relic",
    entityId: "PERMAFROST",
    version: "v0.101.0",
    locale: "kor",
  });
  assert.ok(permafrost101.entity, "PERMAFROST should exist in v0.101.0");

  // -------------------------------------------------------------------------
  // 4. Pure in-memory resolveVersionedEntity (Worker/Client safe)
  // -------------------------------------------------------------------------
  console.log("\n[Test 4] Pure resolveVersionedEntity without disk access");

  const mockCard = {
    id: "MOCK_CARD",
    name: "Mock Card",
    cost: 0,
    type: "스킬",
    rarity: "일반",
    color: "ironclad",
    description: "Original text",
    descriptionRaw: "Original text",
    imageUrl: null,
    betaImageUrl: null,
    vars: { Count: 1 },
  };

  const mockPatches: STS2Patch[] = [
    { id: "v0.100.0", version: "0.100.0", date: "2026-03-20", title: "Patch 100", titleKo: "패치 100", type: "release", hasBalanceChanges: true, steamUrl: null, summary: "", summaryKo: "" },
    { id: "v0.101.0", version: "0.101.0", date: "2026-03-27", title: "Patch 101", titleKo: "패치 101", type: "release", hasBalanceChanges: true, steamUrl: null, summary: "", summaryKo: "" },
  ];

  const mockDiffs: EntityVersionDiff[] = [
    {
      entityType: "card",
      entityId: "MOCK_CARD",
      patch: "v0.100.0",
      diffs: [
        { field: "cost", before: 0, after: 2 },
        { field: "vars.Count", before: 1, after: 5 },
      ],
    },
    {
      entityType: "card",
      entityId: "MOCK_CARD",
      patch: "v0.101.0",
      diffs: [
        { field: "cost", before: 2, after: 0 },
        { field: "vars.Count", before: 5, after: 1 },
      ],
    },
  ];

  const mockChanges: STS2Change[] = [
    { id: "c1", patch: "v0.100.0", entityType: "card", entityId: "MOCK_CARD", character: "ironclad", diffs: [] },
    { id: "c2", patch: "v0.101.0", entityType: "card", entityId: "MOCK_CARD", character: "ironclad", diffs: [] },
  ];

  // Target v0.100.0 from current v0.101.0
  const resolved100 = resolveVersionedEntity({
    entity: mockCard,
    entityType: "card",
    targetVersion: "v0.100.0",
    currentVersion: "v0.101.0",
    versionDiffs: mockDiffs,
    patches: mockPatches,
    changes: mockChanges,
  });

  assert.equal(resolved100.entity?.cost, 2, "Mock card cost at v0.100.0 should be 2");
  assert.equal(resolved100.entity?.vars?.Count, 5, "Mock card vars.Count at v0.100.0 should be 5");
  assert.equal(mockCard.cost, 0, "Original mock card must not be mutated");

  // Target v0.99.0 from current v0.101.0
  const resolved099 = resolveVersionedEntity({
    entity: mockCard,
    entityType: "card",
    targetVersion: "v0.99.0",
    currentVersion: "v0.101.0",
    versionDiffs: mockDiffs,
    patches: mockPatches,
    changes: mockChanges,
  });

  assert.equal(resolved099.entity?.cost, 0, "Mock card cost at v0.99.0 should be 0");
  assert.equal(resolved099.entity?.vars?.Count, 1, "Mock card vars.Count at v0.99.0 should be 1");

  // -------------------------------------------------------------------------
  // 5. Versioned Collection Query: getVersionedEntities
  // -------------------------------------------------------------------------
  console.log("\n[Test 5] getVersionedEntities collection query");

  const cardsAt100 = await getVersionedEntities<CodexCard>({
    entityType: "card",
    version: "v0.100.0",
    locale: "kor",
  });

  assert.ok(cardsAt100.length > 100, "Should return a collection of cards");
  const prepCardInList = cardsAt100.find((c) => c.entityId === "PREPARED");
  assert.ok(prepCardInList, "PREPARED must be present in getVersionedEntities collection");
  assert.equal(prepCardInList.entity?.cost, 1, "PREPARED in v0.100.0 collection must have cost 1");
  assert.equal(prepCardInList.entity?.vars?.Energy, 2, "PREPARED in v0.100.0 collection must have Energy 2");

  // NOT_YET was introduced in v0.103.0, so it must not be available in v0.100.0
  const notYetIn100 = cardsAt100.find((c) => c.entityId === "NOT_YET");
  assert.equal(notYetIn100, undefined, "NOT_YET must not be included in available cards at v0.100.0");

  // -------------------------------------------------------------------------
  // 6. Exhaustive validation of all structured changes across all versions
  // -------------------------------------------------------------------------
  console.log("\n[Test 6] Exhaustive validation of all structured changes across all versions");
  const changesRaw = fs.readFileSync(path.join(process.cwd(), "data/sts2-changes.json"), "utf-8");
  const allChanges: STS2Change[] = JSON.parse(changesRaw);
  let verifiedDiffCount = 0;
  const TEXT_FIELDS = new Set(["name", "description", "descriptionRaw"]);
  const textWarnings: string[] = [];

  for (const change of allChanges) {
    const entityType = normalizeVersionedEntityType(change.entityType);
    if (!entityType || !change.fieldDiffs?.length) continue;

    const res = await getVersionedEntity({
      entityType,
      entityId: change.entityId,
      version: change.patch,
      locale: "kor",
    });

    assert.ok(res.isAvailable, `${entityType}:${change.entityId} should be available at ${change.patch}`);
    assert.ok(res.entity, `${entityType}:${change.entityId} entity should exist at ${change.patch}`);

    for (const fd of change.fieldDiffs) {
      if (fd.upgraded) continue;
      const textField = TEXT_FIELDS.has(fd.field);
      // From the pinned version on, wording follows the game's own tables;
      // scripts/audit-version-locales.ts checks it against them.
      if (textField && compareVersions(change.patch.replace(/^v/, ""), LOCALE_TEXT_PINNED_FROM) > 0) continue;
      verifiedDiffCount++;
      const parts = fd.field.split(".");
      let val: unknown = res.entity;
      for (const p of parts) {
        val = (val as Record<string, unknown> | null | undefined)?.[p];
      }

      // Pinned game text breaks lines and places color tags where the
      // authored diff did not; the words must still match.
      // A template is compared by what it renders with the version's vars: the
      // game may write a literal "1" where an authored diff wrote {Var}.
      const versionVars = varsForBake(entityType, change.entityId, (res.entity as { vars?: unknown }).vars);
      const comparable = (value: unknown) => {
        if (!textField || typeof value !== "string") return value;
        const text = fd.field === "descriptionRaw" ? bakeDescription(value, versionVars) : value;
        return text.replace(/\[\/?[a-z]+(?:[:=][^\]]*)?\]/gi, "").replace(/\s+/g, "");
      };
      const mismatch: string = `Mismatch in ${change.patch} ${entityType}:${change.entityId} (${change.id}) .${fd.field}`;
      // Before the pinned version, Korean wording rests on the pinned game
      // text plus authored diffs; a disagreement is an authored text error
      // or an unrecorded change, listed rather than failed.
      if (textField) {
        if (!util.isDeepStrictEqual(comparable(val), comparable(fd.after))) {
          textWarnings.push(`${mismatch}: shown ${JSON.stringify(val)} / authored ${JSON.stringify(fd.after)}`);
        }
        continue;
      }
      assert.deepEqual(comparable(val), comparable(fd.after), mismatch);
    }
  }
  console.log(`Exhaustively verified ${verifiedDiffCount} fieldDiffs across all patches!`);
  if (textWarnings.length > 0) {
    console.log(`Text that disagrees with authored diffs before v${LOCALE_TEXT_PINNED_FROM} (${textWarnings.length}):`);
    for (const warning of textWarnings) console.log(`  ${warning}`);
  }

  console.log("\n[Test 7] Vars-only card text is rebaked for the library tile");
  const believeBefore = await getVersionedEntity<CodexCard>({
    entityType: "card",
    entityId: "BELIEVE_IN_YOU",
    version: "v0.99.0",
    locale: "kor",
  });
  assert.equal(believeBefore.entity?.vars?.Energy, 3);
  assert.match(believeBefore.entity?.description ?? "", /\[energy:3\]/);

  const believeAfter = await getVersionedEntity<CodexCard>({
    entityType: "card",
    entityId: "BELIEVE_IN_YOU",
    version: "v0.111.0",
    locale: "kor",
  });
  assert.equal(believeAfter.entity?.vars?.Energy, 2);
  assert.match(believeAfter.entity?.description ?? "", /\[energy:2\]/);

  console.log("\n[Test 8] Opening a Compendium detail keeps the version query");
  const detailUrl = new URL("http://localhost/compendium/cards?version=0.110.0&beta=true");
  updateCompendiumResourceModalUrl(detailUrl, "card", "STRIKE");
  assert.equal(detailUrl.pathname, "/compendium/cards/strike");
  assert.equal(detailUrl.searchParams.get("version"), "0.110.0");
  assert.equal(detailUrl.searchParams.get("beta"), "true");
  updateCompendiumResourceModalUrl(detailUrl, "card", null);
  assert.equal(detailUrl.pathname, "/compendium/cards");
  assert.equal(detailUrl.searchParams.get("version"), "0.110.0");

  console.log("\n[Test 9] DOMINATE immediately before and after v0.100.0");
  const dominateBefore = await getVersionedEntity<CodexCard>({
    entityType: "card",
    entityId: "DOMINATE",
    version: "v0.99.0",
    locale: "kor",
  });
  assert.ok(dominateBefore.entity, "DOMINATE should exist before v0.100.0");
  assert.equal(dominateBefore.entity.type, "스킬", "DOMINATE was already a Skill before v0.100.0");
  assert.equal(dominateBefore.entity.rarity, "고급", "DOMINATE was already Uncommon before v0.100.0");
  assert.equal(dominateBefore.entity.cost, 1);
  assert.equal(dominateBefore.entity.vars?.VulnerablePower, undefined);
  assert.equal(dominateBefore.entity.vars?.StrengthPerVulnerable, 1);
  assert.equal(dominateBefore.entity.upgrade?.remove_exhaust, 1);
  assert.equal(dominateBefore.entity.upgrade?.vulnerablepower, undefined);
  assert.equal(
    dominateBefore.entity.description,
    "대상 적이 보유한 [gold]취약[/gold]마다 [gold]힘[/gold]을 1 얻습니다.",
  );
  assert.ok(dominateBefore.entity.keywords?.includes("소멸"));

  const dominateAfter = await getVersionedEntity<CodexCard>({
    entityType: "card",
    entityId: "DOMINATE",
    version: "v0.100.0",
    locale: "kor",
  });
  assert.ok(dominateAfter.entity, "DOMINATE should exist at v0.100.0");
  assert.equal(dominateAfter.entity.type, "스킬");
  assert.equal(dominateAfter.entity.rarity, "고급", "DOMINATE stays Uncommon until v0.109.0");
  assert.equal(dominateAfter.entity.cost, 1);
  assert.equal(dominateAfter.entity.vars?.VulnerablePower, 1);
  assert.equal(dominateAfter.entity.upgrade?.vulnerablepower, "+1");
  assert.equal(dominateAfter.entity.upgrade?.remove_exhaust, undefined);
  assert.equal(
    dominateAfter.entity.description,
    "[gold]취약[/gold]을 1 부여합니다.\n대상 적이 보유한 [gold]취약[/gold]마다\n[gold]힘[/gold]을 1 얻습니다.",
  );

  console.log("\n[Test 10] CORROSIVE_WAVE poison nerf at v0.100.0");
  const waveBefore = await getVersionedEntity<CodexCard>({
    entityType: "card",
    entityId: "CORROSIVE_WAVE",
    version: "v0.99.0",
    locale: "kor",
  });
  assert.equal(waveBefore.entity?.vars?.CorrosiveWave, 3);
  assert.match(waveBefore.entity?.description ?? "", /중독\[\/gold\]을 3/);
  const waveAfter = await getVersionedEntity<CodexCard>({
    entityType: "card",
    entityId: "CORROSIVE_WAVE",
    version: "v0.100.0",
    locale: "kor",
  });
  assert.equal(waveAfter.entity?.vars?.CorrosiveWave, 2);
  assert.match(waveAfter.entity?.description ?? "", /중독\[\/gold\]을 2/);

  console.log("\n[Test 11] FLICK_FLACK damage text follows vars before v0.100.0");
  const flickBefore = await getVersionedEntity<CodexCard>({
    entityType: "card",
    entityId: "FLICK_FLACK",
    version: "v0.99.0",
    locale: "kor",
  });
  assert.equal(flickBefore.entity?.vars?.Damage, 7);
  assert.match(flickBefore.entity?.description ?? "", /피해를 7 줍니다/);
  const flickAfter = await getVersionedEntity<CodexCard>({
    entityType: "card",
    entityId: "FLICK_FLACK",
    version: "v0.100.0",
    locale: "kor",
  });
  assert.equal(flickAfter.entity?.vars?.Damage, 6);
  assert.match(flickAfter.entity?.description ?? "", /피해를 6 줍니다/);

  console.log("\n[Test 12] SPITE before v0.100.0 still draws");
  const spiteBefore = await getVersionedEntity<CodexCard>({
    entityType: "card",
    entityId: "SPITE",
    version: "v0.99.0",
    locale: "kor",
  });
  assert.match(spiteBefore.entity?.description ?? "", /피해를 6 줍니다/);
  assert.match(spiteBefore.entity?.description ?? "", /카드를 1장 뽑습니다/);
  const spiteAfter = await getVersionedEntity<CodexCard>({
    entityType: "card",
    entityId: "SPITE",
    version: "v0.100.0",
    locale: "kor",
  });
  assert.match(spiteAfter.entity?.description ?? "", /2번 적중합니다/);

  console.log("\n[Test 13] INKY stops adding damage at v0.111.0");
  const inkyBefore = await getVersionedEntity<CodexEnchantment>({
    entityType: "enchantment",
    entityId: "INKY",
    version: "v0.110.0",
    locale: "kor",
  });
  const inkyAfter = await getVersionedEntity<CodexEnchantment>({
    entityType: "enchantment",
    entityId: "INKY",
    version: "v0.111.0",
    locale: "kor",
  });
  assert.equal(inkyBefore.entity?.vars?.Damage, 1);
  assert.equal(inkyAfter.entity?.vars?.Damage, undefined);
  assert.equal(getEnchantStatModifier(inkyBefore.entity!, 1).damageAdd, 1);
  assert.equal(getEnchantStatModifier(inkyAfter.entity!, 1).damageAdd, undefined);
  assert.match(inkyBefore.entity?.description ?? "", /피해량이/);
  assert.doesNotMatch(inkyAfter.entity?.description ?? "", /피해량이/);

  console.log("\n[Test 14] current version ignores steam build ids and date slugs");
  assert.equal(latestPatchVersion([
    { version: "0.111.0" },
    { version: "23478716" },
    { version: "2026-09-11" },
    { version: "0.99" },
  ]), "0.111.0");

  console.log("\nAll Versioned Entity API tests PASSED successfully!");
}

runTests().catch((error) => {
  console.error("\nVersioned Entity API test FAILED:", error);
  process.exit(1);
});
