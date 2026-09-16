import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  getVersionedEntity,
  getVersionedEntities,
  resolveVersionedEntity,
} from "../src/lib/versioned-entity-api";
import { normalizeVersionedEntityType } from "../src/lib/codex-versioning";
import type { CodexCard } from "../src/lib/codex-types";
import type { EntityVersionDiff, STS2Change, STS2Patch } from "../src/lib/types";

async function runTests() {
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

  const preparedAt100 = await getVersionedEntity({
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
  assert.equal(preparedAt100.entity.vars?.Cards, undefined, "Prepared vars.Cards in v0.100.0 must not exist");
  assert.ok(
    preparedAt100.entity.description?.includes("에너지"),
    "Prepared description in v0.100.0 must mention energy",
  );
  assert.ok(
    preparedAt100.entity.description?.includes("카드를 2장 버립니다"),
    "Prepared description in v0.100.0 must discard 2 cards",
  );

  // Boundary check: v0.99.0 (prior to rework)
  console.log("[Test 1b] PREPARED Card - Boundary v0.99.0 (pre-rework)");
  const preparedAt099 = await getVersionedEntity({
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
  const preparedAt101 = await getVersionedEntity({
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
    const res = await getVersionedEntity({
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

  const mockCard: CodexCard = {
    id: "MOCK_CARD",
    name: "Mock Card",
    nameKo: "모의 카드",
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
    { id: "v0.100.0", version: "0.100.0", date: "2026-03-20", title: "Patch 100", titleKo: "패치 100", type: "patch", hasBalanceChanges: true, majorChanges: [] },
    { id: "v0.101.0", version: "0.101.0", date: "2026-03-27", title: "Patch 101", titleKo: "패치 101", type: "patch", hasBalanceChanges: true, majorChanges: [] },
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
    { id: "c1", patch: "v0.100.0", entityType: "card", entityId: "MOCK_CARD", diffs: [] },
    { id: "c2", patch: "v0.101.0", entityType: "card", entityId: "MOCK_CARD", diffs: [] },
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

  const cardsAt100 = await getVersionedEntities({
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
      verifiedDiffCount++;
      const parts = fd.field.split(".");
      let val: unknown = res.entity;
      for (const p of parts) {
        val = (val as Record<string, unknown> | null | undefined)?.[p];
      }

      assert.deepEqual(
        val,
        fd.after,
        `Mismatch in ${change.patch} ${entityType}:${change.entityId} (${change.id}) .${fd.field}`
      );
    }
  }
  console.log(`Exhaustively verified ${verifiedDiffCount} fieldDiffs across all patches!`);

  console.log("\nAll Versioned Entity API tests PASSED successfully!");
}

runTests().catch((error) => {
  console.error("\nVersioned Entity API test FAILED:", error);
  process.exit(1);
});
