#!/usr/bin/env node
/**
 * One-shot harvest for history-course cover learning data.
 * Writes into this directory. Not part of the production build.
 *
 * Usage (from repo root):
 *   node research/history-course-covers/harvest.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "../..");
const OUT = __dirname;

function loadEnvLocal() {
  const path = join(ROOT, ".env.local");
  const env = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    env[m[1]] = m[2];
  }
  return env;
}

function writeJson(name, value) {
  writeFileSync(join(OUT, name), `${JSON.stringify(value, null, 2)}\n`, "utf8");
  console.log(`wrote ${name}`);
}

async function fetchComboPosts(env) {
  const base = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SECRET_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const url =
    `${base}/rest/v1/combo_posts?select=id,content,content_text,created_at,env` +
    `&order=created_at.desc&limit=500`;
  const res = await fetch(url, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  });
  if (!res.ok) {
    throw new Error(`combo_posts fetch failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

function entityKey(block) {
  if (!block || block.type !== "entity") return null;
  return `${block.entityType}:${block.entityId}`;
}

function buildCooccurrence(posts) {
  const pairCounts = new Map();
  const entityCounts = new Map();
  const phraseSamples = [];

  for (const post of posts) {
    const entities = [];
    const seen = new Set();
    for (const block of post.content ?? []) {
      const key = entityKey(block);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      entities.push({
        key,
        entityType: block.entityType,
        entityId: block.entityId,
        displayText: block.displayText,
      });
      entityCounts.set(key, (entityCounts.get(key) ?? 0) + 1);
    }
    entities.sort((a, b) => a.key.localeCompare(b.key));
    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const pair = `${entities[i].key}|${entities[j].key}`;
        pairCounts.set(pair, (pairCounts.get(pair) ?? 0) + 1);
      }
    }
    const text = (post.content_text ?? "").trim().replace(/\s+/g, " ");
    if (text.length > 0 && text.length <= 80) {
      phraseSamples.push({
        id: post.id,
        text,
        entityKeys: entities.map((e) => e.key),
      });
    }
  }

  const pairs = [...pairCounts.entries()]
    .map(([pair, count]) => {
      const [a, b] = pair.split("|");
      return { a, b, count };
    })
    .sort((x, y) => y.count - x.count || x.a.localeCompare(y.a));

  const entities = [...entityCounts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((x, y) => y.count - x.count || x.key.localeCompare(y.key));

  return {
    postCount: posts.length,
    entities,
    pairs,
    phraseSamples: phraseSamples.slice(0, 200),
  };
}

async function fetchDonatedRunStats(env) {
  const base = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SECRET_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // metadata + raw for deck stats only; output aggregates, not raw dump
  const url =
    `${base}/rest/v1/runs?select=id,character,ascension,win,total_floors,raw` +
    `&order=created_at.desc&limit=80`;
  const res = await fetch(url, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  });
  if (!res.ok) {
    console.warn(`runs fetch skipped: ${res.status}`);
    return null;
  }
  const rows = await res.json();
  const cardDupHist = {};
  const rarityProxy = { acquiredNonStarter: 0, starterish: 0 };
  const floorBuckets = { early: 0, mid: 0, late: 0 };
  let runsWithDeck = 0;

  for (const row of rows) {
    const raw =
      typeof row.raw === "string"
        ? (() => {
            try {
              return JSON.parse(row.raw);
            } catch {
              return null;
            }
          })()
        : row.raw;
    const player = raw?.players?.[0];
    const deck = player?.deck;
    if (!Array.isArray(deck) || deck.length === 0) continue;
    runsWithDeck++;
    const byId = new Map();
    for (const card of deck) {
      if (typeof card?.id !== "string") continue;
      const id = card.id.includes(".") ? card.id.split(".").pop() : card.id;
      const entry = byId.get(id) ?? { copies: 0, floors: [] };
      entry.copies += 1;
      if (typeof card.floor_added_to_deck === "number") {
        entry.floors.push(card.floor_added_to_deck);
      }
      byId.set(id, entry);
    }
    for (const [id, entry] of byId) {
      const bucket = entry.copies >= 5 ? "5+" : String(entry.copies);
      cardDupHist[bucket] = (cardDupHist[bucket] ?? 0) + 1;
      const minFloor = entry.floors.length ? Math.min(...entry.floors) : 1;
      if (minFloor <= 1) rarityProxy.starterish += 1;
      else rarityProxy.acquiredNonStarter += 1;
      if (minFloor <= 17) floorBuckets.early += 1;
      else if (minFloor <= 34) floorBuckets.mid += 1;
      else floorBuckets.late += 1;
      void id;
    }
  }

  return {
    sampleRuns: rows.length,
    runsWithDeck,
    cardDuplicateHistogram: cardDupHist,
    acquisitionProxy: rarityProxy,
    floorBuckets,
  };
}

function harvestYoutube() {
  const channels = [
    {
      label: "중괄호",
      // @cbrace currently resolves elsewhere; use channel id
      url: "https://www.youtube.com/channel/UC4R_mbbXliNgCUnfQHbQWgQ/videos",
    },
    {
      label: "모카계",
      url: "https://www.youtube.com/channel/UC0qwIzPHn-T6YaYt2Qal_ew/videos",
    },
    {
      label: "최점모",
      // Display name: 첨탑 지박령 최점모 (@최점모 404)
      url: "https://www.youtube.com/channel/UCPCZK2EpglzYJKz6GVbqSIQ/videos",
    },
  ];
  const all = [];
  for (const ch of channels) {
    try {
      const raw = execFileSync(
        "yt-dlp",
        [
          "--flat-playlist",
          "--playlist-end",
          "60",
          "--print",
          "%(id)s\t%(title)s\t%(channel)s\t%(channel_id)s",
          ch.url,
        ],
        { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 },
      );
      for (const line of raw.split("\n")) {
        if (!line.trim()) continue;
        const [id, title, channel, channelId] = line.split("\t");
        if (!id || !title) continue;
        // Prefer STS-ish titles; keep others lightly for phrase grammar
        all.push({
          sourceLabel: ch.label,
          videoId: id,
          title,
          channel,
          channelId,
          stsLikely: /슬더|스파이어|spire|STS|취약|무한|원턴|억까|승천/i.test(title),
        });
      }
      console.log(`youtube ${ch.label}: ok`);
    } catch (err) {
      console.warn(`youtube ${ch.label}: failed — ${err.message?.split("\n")[0] ?? err}`);
      all.push({
        sourceLabel: ch.label,
        error: String(err.message?.split("\n")[0] ?? err),
      });
    }
  }
  return {
    harvestedAt: new Date().toISOString(),
    videos: all.filter((v) => v.videoId),
    errors: all.filter((v) => v.error),
  };
}

async function harvestSlgall() {
  const sources = readFileSync(join(OUT, "sources.md"), "utf8");
  const urls = [...sources.matchAll(/https:\/\/gall\.dcinside\.com\/mgallery\/board\/view\/\?id=slay&no=\d+/g)].map(
    (m) => m[0],
  );
  const unique = [...new Set(urls)];
  const samples = [];
  for (const url of unique) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; scare-the-spire-research/1.0; +local learning harvest)",
          Accept: "text/html",
        },
      });
      const html = await res.text();
      const titleMatch =
        html.match(/<title>([^<]*)<\/title>/i) ||
        html.match(/property="og:title"\s+content="([^"]*)"/i);
      const title = (titleMatch?.[1] ?? "")
        .replace(/\s*-\s*dcinside.*$/i, "")
        .replace(/\s+/g, " ")
        .trim();
      const hasImage = /og:image|class="[^"]*writing_view_img|img_container/i.test(html);
      const bodyMatch = html.match(/class="write_div"[\s\S]*?<\/div>/i);
      const bodyText = (bodyMatch?.[0] ?? "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 160);
      samples.push({
        url,
        ok: res.ok,
        title,
        bodyPreview: bodyText,
        likelyHasMedia: hasImage,
        bodyLen: bodyText.length,
      });
      await new Promise((r) => setTimeout(r, 250));
    } catch (err) {
      samples.push({ url, ok: false, error: String(err.message ?? err) });
    }
  }
  return { harvestedAt: new Date().toISOString(), samples };
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const env = loadEnvLocal();

  console.log("harvesting combo_posts…");
  const posts = await fetchComboPosts(env);
  writeFileSync(
    join(OUT, "combo-posts.jsonl"),
    posts.map((p) => JSON.stringify({ id: p.id, content_text: p.content_text, content: p.content, created_at: p.created_at, env: p.env })).join("\n") +
      (posts.length ? "\n" : ""),
    "utf8",
  );
  console.log(`wrote combo-posts.jsonl (${posts.length})`);
  writeJson("combo-cooccurrence.json", buildCooccurrence(posts));

  console.log("harvesting donated run deck stats…");
  const deckStats = await fetchDonatedRunStats(env);
  if (deckStats) writeJson("donated-run-deck-stats.json", deckStats);

  console.log("harvesting youtube titles…");
  writeJson("youtube-titles.json", harvestYoutube());

  console.log("harvesting slgall seed titles…");
  writeJson("slgall-samples.json", await harvestSlgall());

  console.log("done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
