import assert from "node:assert/strict";
import fs from "node:fs";
import {
  CARD_ART_IMAGE_ASPECT,
  clampAssetWidth,
  defaultAssetBox,
  sizedAssetBox,
  WIDE_ART_MAX_WIDTH,
  WIDE_ART_MIN_WIDTH,
} from "../src/components/pagestorm/sample";
import {
  PAGESTORM_ASSET_ROW_MAX,
  pagestormDropZone,
  pagestormEmbedMinWidth,
  pagestormPointerZone,
  pagestormRowFits,
} from "../src/components/pagestorm/asset-layout";
import {
  markdownLinkBeforeCursor,
  migratePagestormDoc,
  pagestormPasteContent,
  parseIndentedList,
} from "../src/components/pagestorm/markdown-blocks";
import type { EntityInfo } from "../src/components/patch-note-renderer";
import {
  parsePagestormReferenceQuery,
  rankPagestormReferences,
  resolvePagestormReference,
} from "../src/lib/pagestorm-reference";
import {
  PAGESTORM_BACKGROUND_SRC,
  PAGESTORM_BETA_ART_SRC,
  pagestormFirstAssetThumb,
  pagestormIndexThumb,
  type PagestormDoc,
} from "../src/lib/pagestorm";
import {
  applyPagestormTransfigureChoice,
  isPagestormToyboxPickerHref,
  PAGESTORM_TRANSFIGURE_REEL_PIPS_HEIGHT,
  parsePagestormTransfigureReel,
  pagestormToyboxEmbedHeight,
  pagestormToyboxFederatedFromHref,
  pagestormToyboxPickerMode,
  pagestormToyboxJsonArray,
  pagestormToyboxNodeAttrs,
  pagestormToyboxPostHref,
  pagestormToyboxServiceHref,
  parsePagestormTransfigurePreview,
} from "../src/lib/pagestorm-toybox";

const doc: PagestormDoc = {
  type: "doc",
  content: [
    {
      type: "gameAsset",
      attrs: {
        kind: "card",
        presentation: "tile",
        imageUrl: "/images/sts2/cards/pagestorm.webp",
        name: "서류 폭풍",
      },
    },
    {
      type: "gameAsset",
      attrs: {
        kind: "event",
        presentation: "art",
        imageUrl: "/images/sts2/events/abyssal_baths.webp",
        name: "심연의 욕탕",
      },
    },
  ],
};

const thumb = pagestormFirstAssetThumb(doc);
assert.ok(thumb);
assert.equal(thumb.kind, "event");
assert.equal(thumb.imageUrl, "/images/sts2/events/abyssal_baths.webp");

const tileOnly = pagestormFirstAssetThumb({
  type: "doc",
  content: [doc.content![0]],
});
assert.ok(tileOnly);
assert.equal(tileOnly.kind, "card");

assert.equal(pagestormFirstAssetThumb({ type: "doc", content: [] }), null);

const characterThenCard: PagestormDoc = {
  type: "doc",
  content: [
    {
      type: "gameAsset",
      attrs: {
        kind: "character",
        presentation: "art",
        imageUrl: "/images/sts2/characters/char_select_ironclad.webp",
        name: "아이언클래드",
      },
    },
    {
      type: "gameAsset",
      attrs: {
        kind: "card",
        presentation: "art",
        imageUrl: PAGESTORM_BACKGROUND_SRC,
        name: "서류 폭풍",
      },
    },
  ],
};
const artOverPortrait = pagestormFirstAssetThumb(characterThenCard);
assert.ok(artOverPortrait);
assert.equal(artOverPortrait.kind, "card");
assert.equal(artOverPortrait.imageUrl, PAGESTORM_BACKGROUND_SRC);

const betaArt = pagestormFirstAssetThumb({
  type: "doc",
  content: [{
    type: "gameAsset",
    attrs: {
      assetId: "WITHER",
      kind: "card",
      presentation: "art",
      beta: true,
      imageUrl: "/images/sts2/cards/wither1.webp",
      name: "시듦",
    },
  }],
});
assert.equal(betaArt?.imageUrl, "/images/sts2/cards-beta/wither.webp");

const baseArt = pagestormFirstAssetThumb({
  type: "doc",
  content: [{
    type: "gameAsset",
    attrs: {
      assetId: "WITHER",
      kind: "card",
      presentation: "art",
      beta: false,
      imageUrl: "/images/sts2/cards/wither1.webp",
      name: "시듦",
    },
  }],
});
assert.equal(baseArt?.imageUrl, "/images/sts2/cards/wither1.webp");

const cardRows = JSON.parse(fs.readFileSync("data/sts2/eng/cards.json", "utf8")) as Array<{
  id: string;
  beta_image_url: string | null;
}>;
function localBeta(url: string | null): string | null {
  if (!url) return null;
  const marker = "/static/images/";
  const index = url.indexOf(marker);
  if (index < 0) return null;
  const relative = url.slice(index + marker.length).replace(/^cards\/beta\//, "cards-beta/");
  return `/images/sts2/${relative.replace(/\.png$/, ".webp")}`;
}
for (const card of cardRows) {
  const beta = localBeta(card.beta_image_url);
  if (!beta) continue;
  const thumb = pagestormFirstAssetThumb({
    type: "doc",
    content: [{
      type: "gameAsset",
      attrs: {
        assetId: card.id,
        kind: "card",
        presentation: "art",
        beta: true,
        imageUrl: "/images/sts2/cards/original.webp",
      },
    }],
  });
  assert.equal(thumb?.imageUrl, beta, card.id);
}

const relicOnly = pagestormFirstAssetThumb({
  type: "doc",
  content: [{
    type: "gameAsset",
    attrs: {
      kind: "relic",
      presentation: "art",
      imageUrl: "/images/sts2/relics/chemical_x.webp",
      name: "케미컬 X",
    },
  }],
});
assert.ok(relicOnly);
assert.equal(relicOnly.kind, "relic");

const emptyIndex = pagestormIndexThumb({ type: "doc", content: [] });
assert.equal(emptyIndex.imageUrl, PAGESTORM_BETA_ART_SRC);
assert.equal(emptyIndex.kind, "card");

assert.equal(clampAssetWidth("card", 2000, "art"), WIDE_ART_MAX_WIDTH);
assert.equal(clampAssetWidth("event", 2000, "art"), WIDE_ART_MAX_WIDTH);
assert.equal(clampAssetWidth("epoch", 2000, "art"), WIDE_ART_MAX_WIDTH);
assert.equal(clampAssetWidth("card", 2000, "tile"), 380);

const wideCardArt = sizedAssetBox("card", 1080, 10, "art");
assert.equal(wideCardArt.width, WIDE_ART_MAX_WIDTH);
assert.equal(wideCardArt.height, Math.round(WIDE_ART_MAX_WIDTH / CARD_ART_IMAGE_ASPECT));

const tileBox = sizedAssetBox("card", 150, 211, "tile");
assert.equal(tileBox.width, 150);
assert.equal(tileBox.height, 211);

const artDefault = defaultAssetBox("card", "art");
assert.equal(artDefault.width, WIDE_ART_MIN_WIDTH);
assert.equal(artDefault.height, Math.round(WIDE_ART_MIN_WIDTH / CARD_ART_IMAGE_ASPECT));

assert.equal(pagestormDropZone(0.2, 0.1), "before");
assert.equal(pagestormDropZone(0.8, 0.9), "after");
assert.equal(pagestormDropZone(0.2, 0.25), "left");
assert.equal(pagestormDropZone(0.2, 0.5), "left");
assert.equal(pagestormDropZone(0.8, 0.5), "right");
assert.equal(pagestormPointerZone(0.5, -0.2, false, 0.2), "before");
assert.equal(pagestormPointerZone(0.5, 1.2, false, 0.8), "after");
assert.equal(pagestormPointerZone(-0.2, 0.5, false, 0.5), "left");
assert.equal(pagestormPointerZone(1.2, 0.5, false, 0.5), "right");
assert.equal(pagestormPointerZone(0.2, 0.5, true, 0.8), "left");

const nestedArt = pagestormFirstAssetThumb({
  type: "doc",
  content: [{
    type: "assetRow",
    content: [
      {
        type: "gameAsset",
        attrs: {
          kind: "card",
          presentation: "tile",
          imageUrl: "/images/sts2/cards/strike.webp",
          name: "타격",
        },
      },
      {
        type: "gameAsset",
        attrs: {
          kind: "card",
          presentation: "art",
          imageUrl: PAGESTORM_BACKGROUND_SRC,
          name: "서류 폭풍",
        },
      },
    ],
  }],
});
assert.ok(nestedArt);
assert.equal(nestedArt.presentation, "art");
assert.equal(nestedArt.imageUrl, PAGESTORM_BACKGROUND_SRC);

assert.equal(pagestormToyboxFederatedFromHref("/this-or-that"), "this_or_that");
assert.equal(pagestormToyboxFederatedFromHref("/en/decisions-decisions"), "decisions_decisions");
assert.equal(pagestormToyboxFederatedFromHref("/pagestorm"), "pagestorm");
assert.equal(pagestormToyboxFederatedFromHref("/history-course"), "history_course");
assert.equal(pagestormToyboxPickerMode(null), "all");
assert.equal(pagestormToyboxPickerMode("/defragment"), "unsupported");
assert.equal(pagestormToyboxPickerMode("/history-course"), "unsupported");
assert.equal(pagestormToyboxPickerMode("/pagestorm"), "unsupported");
assert.equal(isPagestormToyboxPickerHref("/chemical-x"), false);
assert.equal(isPagestormToyboxPickerHref("/c-c-c-combo"), false);
assert.equal(isPagestormToyboxPickerHref("/defragment"), false);
assert.equal(isPagestormToyboxPickerHref("/transfigure"), true);
assert.equal(isPagestormToyboxPickerHref("/this-or-that"), true);
assert.equal(isPagestormToyboxPickerHref("/history-course"), false);
assert.equal(isPagestormToyboxPickerHref("/pagestorm"), false);
assert.equal(pagestormToyboxServiceHref("this_or_that"), "/this-or-that");
assert.equal(pagestormToyboxEmbedHeight("/this-or-that"), 248);
assert.equal(pagestormToyboxEmbedHeight("/transfigure", "card"), 420);
assert.equal(pagestormToyboxEmbedHeight("/transfigure", "relic"), 448);
assert.equal(pagestormToyboxEmbedHeight("/transfigure", "potion"), 340);
assert.equal(
  pagestormToyboxPostHref("this_or_that", "post-1", "ko", "kor"),
  "/this-or-that/post-1",
);
assert.equal(
  pagestormToyboxPostHref("/this-or-that", "post-1", "ko", "kor"),
  "/this-or-that/post-1",
);
assert.deepEqual(
  pagestormToyboxJsonArray('[{"id":"a"}]'),
  [{ id: "a" }],
);
const snapshotAttrs = pagestormToyboxNodeAttrs({
  id: "live-1",
  service: "/this-or-that",
  userId: "u1",
  title: "높이맞음?",
  nickname: "디황",
  leftType: "card",
  leftId: "strike",
  rightType: "card",
  rightId: "defend",
  rows: [],
  placements: [],
  pool: [],
  tokenSrc: "/images/sts2/relics/choices_paradox.webp",
  transfigure: null,
});
assert.equal(snapshotAttrs.postId, "live-1");
assert.equal(snapshotAttrs.leftType, "card");
assert.equal(snapshotAttrs.height, 248);
assert.equal(snapshotAttrs.rowsJson, "[]");
assert.equal(snapshotAttrs.transfigureJson, "null");

const transfigurePreview = parsePagestormTransfigurePreview({
  blocks: [{ type: "text", text: "장갑이 따뜻하다" }],
  transformedName: "따뜻한 장갑",
  cardTopKeywords: [],
  cardBottomKeywords: [],
  upgradedCardTopKeywords: [],
  upgradedCardBottomKeywords: [],
  showUpgrade: false,
  tokenColor: "gold",
  tokenWax: "",
});
assert.ok(transfigurePreview);
assert.equal(transfigurePreview.transformedName, "따뜻한 장갑");
assert.equal(transfigurePreview.tokenColor, "gold");
assert.equal(transfigurePreview.omitEnergyCost, false);
assert.equal(parsePagestormTransfigurePreview("null"), null);
assert.equal(parsePagestormTransfigurePreview(""), null);

const transfigureAttrs = pagestormToyboxNodeAttrs({
  id: "tf-1",
  service: "/transfigure",
  userId: "u1",
  title: "따뜻한 장갑(리워크)",
  nickname: "디황",
  leftType: "relic",
  leftId: "TOASTY_MITTENS",
  rightType: "",
  rightId: "",
  rows: [],
  placements: [],
  pool: [],
  tokenSrc: "",
  transfigure: transfigurePreview,
});
assert.equal(transfigureAttrs.height, 448);
assert.match(transfigureAttrs.transfigureJson, /따뜻한 장갑/);
assert.equal(transfigureAttrs.transfigureReelJson, "[]");

const multiVariantSnapshot = {
  id: "tf-2",
  service: "/transfigure",
  userId: "u1",
  title: "교활 리워크",
  nickname: "디황",
  leftType: "keyword",
  leftId: "SLY",
  rightType: "",
  rightId: "",
  rows: [],
  placements: [],
  pool: [],
  tokenSrc: "",
  transfigure: transfigurePreview,
  transfigureVariants: [
    { resourceType: "keyword", resourceId: "SLY", preview: transfigurePreview },
    { resourceType: "card", resourceId: "TACTICIAN", preview: transfigurePreview },
    { resourceType: "relic", resourceId: "TOASTY_MITTENS", preview: transfigurePreview },
  ],
};
const reelSnapshot = applyPagestormTransfigureChoice(multiVariantSnapshot, "reel");
const reelAttrs = pagestormToyboxNodeAttrs(reelSnapshot);
assert.equal(reelAttrs.leftType, "keyword");
assert.equal(parsePagestormTransfigureReel(reelAttrs.transfigureReelJson).length, 3);
assert.equal(reelAttrs.height, 448 + PAGESTORM_TRANSFIGURE_REEL_PIPS_HEIGHT);

const secondSnapshot = applyPagestormTransfigureChoice(multiVariantSnapshot, 1);
const secondAttrs = pagestormToyboxNodeAttrs(secondSnapshot);
assert.equal(secondAttrs.leftType, "card");
assert.equal(secondAttrs.leftId, "TACTICIAN");
assert.equal(secondAttrs.transfigureReelJson, "[]");
assert.equal(secondAttrs.height, 420);

assert.equal(pagestormRowFits(320, [140, 140]), true);
assert.equal(pagestormRowFits(300, [140, 140]), false);
assert.equal(pagestormRowFits(1000, [40, 40, 40, 40]), true);
assert.equal(pagestormRowFits(4000, Array.from({ length: PAGESTORM_ASSET_ROW_MAX + 1 }, () => 40)), false);
assert.equal(pagestormEmbedMinWidth("gameAsset", { kind: "card", presentation: "tiny" }), 40);
assert.equal(pagestormEmbedMinWidth("toyboxEmbed", {}), 200);

const nested = parseIndentedList("- alpha\n  - beta\n    - gamma\n- delta");
assert.equal(nested?.type, "bulletList");
assert.equal(nested?.content?.length, 2);
const nestedBeta = nested?.content?.[0]?.content?.[1];
assert.equal(nestedBeta?.type, "bulletList");
assert.equal(nestedBeta?.content?.[0]?.content?.[1]?.type, "bulletList");
const pasted = pagestormPasteContent("[글](https://example.com/a)");
assert.equal(pasted?.[0]?.type, "paragraph");
assert.equal(pasted?.[0]?.content?.[0]?.text, "글");
assert.equal(pasted?.[0]?.content?.[0]?.marks?.[0]?.attrs?.href, "https://example.com/a");
const typedLink = markdownLinkBeforeCursor("앞에 [글](https://example.com", ")");
assert.ok(typedLink);
assert.equal(typedLink.label, "글");
const migrated = migratePagestormDoc({
  type: "doc",
  content: [{
    type: "ogBookmark",
    attrs: { url: "https://example.com", title: "글", align: "center" },
  }],
});
assert.equal(migrated.content?.[0]?.type, "paragraph");
assert.equal(migrated.content?.[0]?.content?.[0]?.text, "글");
assert.equal(migrated.content?.[0]?.content?.[0]?.marks?.[0]?.type, "link");

function mention(id: string, nameKo: string, nameEn: string, type: EntityInfo["type"]): EntityInfo {
  return { id, nameKo, nameEn, type, imageUrl: null, color: "", href: `/${type}/${id}` };
}
const sts2Strike = mention("STRIKE", "타격", "Strike", "card");
const sts1Strike = mention("sts1:cards:strike", "타격", "Strike", "card");
const sts2Bash = mention("BASH", "강타", "Bash", "card");
const sts1Die = mention("sts1:cards:die-die-die", "죽어 죽어 죽어", "Die Die Die", "card");
const sts2 = [sts2Strike, sts2Bash];
const sts1 = [sts1Strike, sts1Die];
assert.deepEqual(parsePagestormReferenceQuery("타격"), { name: "타격", game: "sts2", version: null });
assert.deepEqual(parsePagestormReferenceQuery("타격#1"), { name: "타격", game: "sts1", version: null });
assert.deepEqual(parsePagestormReferenceQuery("예비@0.99.1"), { name: "예비", game: "sts2", version: "0.99.1" });
assert.deepEqual(parsePagestormReferenceQuery("타격#1@2.0"), { name: "타격", game: "sts1", version: "2.0" });
assert.equal(resolvePagestormReference("타격", sts2, sts1)?.id, "STRIKE");
assert.equal(resolvePagestormReference("타격#1", sts2, sts1)?.id, "sts1:cards:strike");
assert.equal(resolvePagestormReference("예비@0.99.1", sts2, sts1), null);
assert.equal(resolvePagestormReference("죽어 죽어 죽어", sts2, sts1)?.id, "sts1:cards:die-die-die");
assert.equal(rankPagestormReferences("타격", sts2, sts1)[0]?.id, "STRIKE");
assert.equal(rankPagestormReferences("타격#1", sts2, sts1)[0]?.id, "sts1:cards:strike");
assert.equal(rankPagestormReferences("타#1", sts2, sts1)[0]?.id, "sts1:cards:strike");
assert.equal(rankPagestormReferences("죽어 죽어 죽어", sts2, sts1)[0]?.id, "sts1:cards:die-die-die");

assert.deepEqual(parsePagestormTransfigureReel("[]"), []);
assert.deepEqual(parsePagestormTransfigureReel("not json"), []);
assert.deepEqual(parsePagestormTransfigureReel([{ resourceType: "card" }]), []);

// --- Step 6: pagestorm reads and writes go only through the Worker -------------------
// (docs/supabase-exit/STEP6_PLAN.md WP-T2). Every former legacy signal is the screen's
// failure, with one request and nothing redone on a direct Supabase path.
async function apiOnly() {
  const fakeStorage = new Map<string, string>();
  Object.assign(globalThis, {
    window: {
      localStorage: {
        getItem: (key: string) => fakeStorage.get(key) ?? null,
        setItem: (key: string, value: string) => void fakeStorage.set(key, value),
        removeItem: (key: string) => void fakeStorage.delete(key),
        key: (index: number) => [...fakeStorage.keys()][index] ?? null,
        get length() {
          return fakeStorage.size;
        },
      },
    },
    // A claimed browser in cookie mode: writes go out without a claim request.
    document: { cookie: "slseoun_idm=cookie" },
  });
  fakeStorage.set("slseoun-identity", JSON.stringify({ uid: "user-1", at: "2026-11-09T00:00:00.000Z" }));

  const { ApiUnavailableError } = await import("../src/lib/api-client");
  const { dataEnv } = await import("../src/lib/data-env");
  const { loadPagestormToyboxSnapshot } = await import("../src/hooks/use-pagestorm-toybox");
  const { deletePagestormDraft, insertPagestormDraft, insertPagestormPost } = await import("../src/hooks/use-pagestorm-posts");

  const requests: { url: string; method: string; body: unknown }[] = [];
  const marked = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "x-slseoun-api": "1" },
  });
  const stub = (respond: () => Response) => {
    requests.length = 0;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push({
        url: String(input),
        method: init?.method ?? "GET",
        body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
      });
      return respond();
    }) as typeof fetch;
  };
  const onlyApi = () => {
    for (const request of requests) assert.ok(request.url.startsWith("/api/"), `same-origin /api only: ${request.url}`);
  };
  const legacySignal = () => marked({ error: "surface_legacy" }, 409);
  const pick = { id: "post-1", service: "/this-or-that", userId: "u", title: "pick title", nickname: "pick nick" };

  // A toybox embed reads its row from /api/read/toybox-post.
  stub(() => marked([{ reason: "row reason", nickname: "row nick", left_type: "card", left_id: "A", right_type: "relic", right_id: "B" }]));
  const snapshot = await loadPagestormToyboxSnapshot(pick);
  assert.equal(snapshot.title, "row reason");
  assert.equal(snapshot.nickname, "row nick");
  assert.deepEqual([snapshot.leftType, snapshot.leftId, snapshot.rightType, snapshot.rightId], ["card", "A", "relic", "B"]);
  assert.deepEqual(requests.map((request) => request.url), ["/api/read/toybox-post?service=this_or_that&id=post-1"]);

  // No row: the pick as it was.
  stub(() => marked([]));
  assert.equal((await loadPagestormToyboxSnapshot(pick)).title, "pick title");

  // A legacy signal, an answer without the router marker, and a 5xx are an outage.
  for (const respond of [legacySignal, () => new Response("<html>", { status: 200 }), () => marked({ error: "upstream" }, 503)]) {
    stub(respond);
    await assert.rejects(loadPagestormToyboxSnapshot(pick), ApiUnavailableError);
    assert.equal(requests.length, 1);
    onlyApi();
  }

  // History course embeds read nothing.
  stub(() => marked([]));
  const run = await loadPagestormToyboxSnapshot({ ...pick, service: "/history-course" });
  assert.equal(run.title, "pick title");
  assert.equal(requests.length, 0);

  // Writes: invalid input and no user write nothing.
  const input = {
    nickname: " 닉네임 ",
    title: " 제목 ",
    content: doc,
    contentText: " 본문 ",
    activeUserId: "user-1",
  };
  stub(() => marked([]));
  assert.equal(await insertPagestormPost({ ...input, title: " " }), null);
  assert.equal(await insertPagestormDraft({ ...input, activeUserId: "" }), null);
  assert.equal(await deletePagestormDraft("draft-1", ""), false);
  assert.equal(requests.length, 0);

  // A post insert sends the trimmed row with the data env.
  stub(() => marked([{ id: "new-post", title: "제목", created_at: "2026-11-09T00:00:00.000Z" }], 201));
  assert.equal((await insertPagestormPost(input))?.id, "new-post");
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "/api/write/toybox-post?service=pagestorm");
  assert.equal(requests[0].method, "POST");
  assert.deepEqual(
    (({ user_id, nickname, title, content_text, env }) => ({ user_id, nickname, title, content_text, env }))(requests[0].body as Record<string, unknown>),
    { user_id: "user-1", nickname: "닉네임", title: "제목", content_text: "본문", env: dataEnv },
  );

  // A refused write keeps the database code the composer reads (check violation: 23514).
  stub(() => marked({ error: "check_violation" }, 400));
  await assert.rejects(insertPagestormDraft(input), (error: { code?: string }) => error.code === "23514");
  assert.equal(requests.length, 1);

  // A legacy signal on a write is "unavailable" and is not sent again anywhere.
  for (const write of [() => insertPagestormPost(input), () => insertPagestormDraft(input), () => deletePagestormDraft("draft-1", "user-1")]) {
    stub(legacySignal);
    await assert.rejects(write(), (error: { code?: string }) => error.code === "unavailable");
    assert.equal(requests.length, 1);
    onlyApi();
  }
}

apiOnly().then(
  () => console.log("pagestorm.spec.ts: ok"),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
