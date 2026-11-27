/**
 * Moving visitors from the workers.dev host to the own domain (LEGACY_HOST_REDIRECT), profile included.
 *
 * Identity cookies, localStorage and IndexedDB belong to a host, so a plain redirect would land a
 * returning visitor on an empty profile. Instead every page request on the old host gets a linkless
 * page (crawlers find nothing to follow) whose script reads that host's storage and a short-lived
 * identity token, and posts them as a top-level form to the new domain's /__handoff. That response
 * sets the identity cookie, writes the storage back and replaces itself with the requested page.
 * Search engines get a plain 301 for Search Console's change of address; www always moves.
 */
import { readCookie, isPageRequest } from "./api/flag-cookie";
import {
  IDENTITY_COOKIE_MAX_AGE_SECONDS,
  identityCookieHeader,
  identitySecret,
  signIdentityCookie,
  verifyIdentityCookie,
  type IdentityEnv,
} from "./api/identity/cookie";
import { IDENTITY_COOKIE_NAME } from "../src/lib/identity-cookies";

export type LegacyHostEnv = IdentityEnv & {
  /** Origin the legacy workers.dev host moves to (wrangler.jsonc vars); unset keeps serving it. */
  LEGACY_HOST_REDIRECT?: string;
};

/** The production workers.dev host. Testbed and version preview hosts never move. */
export const LEGACY_WORKERS_DEV_HOST = "scare-the-spire.flavono123.workers.dev";
export const HANDOFF_TOKEN_PATH = "/api/auth/handoff";
export const HANDOFF_RECEIVE_PATH = "/__handoff";
/** Seconds a handoff token stays valid: long enough for one form post. */
const HANDOFF_TOKEN_SECONDS = 120;
/** Set on the old host once its storage went over, so a later visit never overwrites newer data. */
const HANDOFF_DONE_KEY = "slseoun-handoff-done";
const MAX_HANDOFF_BYTES = 50 * 1024 * 1024;
const SEARCH_ENGINE_UA = /Googlebot|bingbot|Yeti|DuckDuckBot|Applebot/i;
const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;
// Same database as src/lib/run-store.ts. Runs cached from someone else's share stay behind.
const RUN_DB = "scare-the-spire";
const RUN_STORE = "runs";

const htmlHeaders = {
  "content-type": "text/html; charset=utf-8",
  "cache-control": "no-store",
  "x-robots-tag": "noindex",
};

function moveTarget(url: URL, env: LegacyHostEnv): URL | null {
  if (!env.LEGACY_HOST_REDIRECT) return null;
  try {
    return new URL(`${url.pathname}${url.search}`, env.LEGACY_HOST_REDIRECT);
  } catch {
    return null;
  }
}

export async function handleLegacyHostMove(request: Request, url: URL, env: LegacyHostEnv): Promise<Response | null> {
  const target = moveTarget(url, env);
  if (!target) return null;

  if (url.hostname === `www.${target.hostname}`) return redirect(request, target);
  if (url.hostname === target.hostname) {
    return url.pathname === HANDOFF_RECEIVE_PATH ? receiveHandoff(request, target, env) : null;
  }
  if (url.hostname !== LEGACY_WORKERS_DEV_HOST) return null;

  if (SEARCH_ENGINE_UA.test(request.headers.get("user-agent") ?? "")) return redirect(request, target);
  if (url.pathname === HANDOFF_TOKEN_PATH && request.method === "POST") return handoffToken(request, env);
  if (isPageRequest(request, url)) return handoffPage(target);
  // API calls from tabs still open on the old host keep working until they reload.
  if (readCookie(request, IDENTITY_COOKIE_NAME) !== null) return null;
  return redirect(request, target);
}

function redirect(request: Request, target: URL): Response {
  const read = request.method === "GET" || request.method === "HEAD";
  return Response.redirect(target.toString(), read ? 301 : 308);
}

/** Old host: the visitor's identity as a cookie value that expires in two minutes. */
async function handoffToken(request: Request, env: LegacyHostEnv): Promise<Response> {
  const secret = identitySecret(env);
  let token = "";
  if (secret) {
    const check = await verifyIdentityCookie(secret, readCookie(request, IDENTITY_COOKIE_NAME));
    if (check.ok) {
      const now = Math.floor(Date.now() / 1000);
      token = await signIdentityCookie(secret, check.uid, now - IDENTITY_COOKIE_MAX_AGE_SECONDS + HANDOFF_TOKEN_SECONDS);
    }
  }
  return Response.json({ token }, { headers: { "cache-control": "no-store" } });
}

function attr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function scriptString(value: string): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

/** Old host: read storage and identity, post them to the new domain, or just go when there is none. */
export function handoffPage(target: URL): Response {
  const to = scriptString(target.toString());
  const receive = scriptString(new URL(HANDOFF_RECEIVE_PATH, target).toString());
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="robots" content="noindex">`
    + `<link rel="canonical" href="${attr(target.toString())}">`
    + `<noscript><meta http-equiv="refresh" content="0;url=${attr(target.toString())}"></noscript>`
    + `<script>(async function(){var to=${to}+location.hash;`
    + `try{if(localStorage.getItem("${HANDOFF_DONE_KEY}")){location.replace(to);return}}catch(e){}`
    + `var ls={},n=0;try{for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);ls[k]=localStorage.getItem(k);n++}}catch(e){}`
    + `var runs=[];try{runs=await new Promise(function(res){var r=indexedDB.open("${RUN_DB}");`
    + `r.onupgradeneeded=function(){r.transaction.abort()};r.onerror=function(){res([])};`
    + `r.onsuccess=function(){var db=r.result;if(!db.objectStoreNames.contains("${RUN_STORE}")){db.close();res([]);return}`
    + `var q=db.transaction("${RUN_STORE}").objectStore("${RUN_STORE}").getAll();`
    + `q.onsuccess=function(){db.close();res(q.result.filter(function(x){return x&&x.origin!=="donation-cache"}))};`
    + `q.onerror=function(){db.close();res([])}}})}catch(e){}`
    + `var t="";try{var r=await fetch("${HANDOFF_TOKEN_PATH}",{method:"POST",credentials:"same-origin"});if(r.ok)t=(await r.json()).token||""}catch(e){}`
    + `if(!t&&!n&&!runs.length){location.replace(to);return}`
    + `var u=new TextEncoder().encode(JSON.stringify({ls:ls,runs:runs})),b="";`
    + `for(var j=0;j<u.length;j+=32768)b+=String.fromCharCode.apply(null,u.subarray(j,j+32768));`
    + `try{localStorage.setItem("${HANDOFF_DONE_KEY}","1")}catch(e){}`
    + `var f=document.createElement("form");f.method="POST";f.action=${receive};f.enctype="text/plain";`
    + `[["t",t],["p",to.slice(to.indexOf("/",8))],["d",btoa(b)]].forEach(function(x){var i=document.createElement("input");i.type="hidden";i.name=x[0];i.value=x[1];f.appendChild(i)});`
    + `document.body.appendChild(f);f.submit()})()</script></head><body></body></html>`;
  return new Response(html, { headers: htmlHeaders });
}

/** `name=value` lines of a text/plain form body. Values here never hold a line break. */
function readPlainForm(body: string): Map<string, string> {
  const fields = new Map<string, string>();
  for (const line of body.split("\r\n")) {
    const eq = line.indexOf("=");
    if (eq > 0) fields.set(line.slice(0, eq), line.slice(eq + 1));
  }
  return fields;
}

/** New domain: only the old host's own page may post here (Origin), the identity must verify. */
async function receiveHandoff(request: Request, target: URL, env: LegacyHostEnv): Promise<Response> {
  const home = new URL("/", target);
  if (request.method !== "POST" || request.headers.get("origin") !== `https://${LEGACY_WORKERS_DEV_HOST}`) {
    return Response.redirect(home.toString(), 303);
  }
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > MAX_HANDOFF_BYTES) return Response.redirect(home.toString(), 303);
  const fields = readPlainForm(await request.text());

  const path = fields.get("p") ?? "/";
  const next = path.startsWith("/") && !path.startsWith("//") ? new URL(path, home) : home;
  const data = fields.get("d") ?? "";
  const cookies: string[] = [];
  const secret = identitySecret(env);
  const token = fields.get("t") ?? "";
  if (secret && token) {
    const check = await verifyIdentityCookie(secret, token);
    if (check.ok) cookies.push(identityCookieHeader(await signIdentityCookie(secret, check.uid), true));
  }

  const payload = data.length > 0 && BASE64.test(data) ? data : "";
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="robots" content="noindex">`
    + `<script id="d" type="text/plain">${payload}</script>`
    + `<script>(async function(){var to=${scriptString(next.toString())};try{var d=document.getElementById("d").textContent;`
    + `if(d){var s=atob(d),u=new Uint8Array(s.length);for(var i=0;i<s.length;i++)u[i]=s.charCodeAt(i);`
    + `var o=JSON.parse(new TextDecoder().decode(u)),ls=o.ls||{};`
    + `for(var k in ls){try{localStorage.setItem(k,ls[k])}catch(e){}}`
    + `if(o.runs&&o.runs.length)await new Promise(function(res){var r=indexedDB.open("${RUN_DB}",1);`
    + `r.onupgradeneeded=function(){var db=r.result;if(!db.objectStoreNames.contains("${RUN_STORE}")){var st=db.createObjectStore("${RUN_STORE}",{keyPath:"runId"});st.createIndex("savedAt","savedAt")}};`
    + `r.onerror=function(){res()};r.onsuccess=function(){var db=r.result,tx=db.transaction("${RUN_STORE}","readwrite"),st=tx.objectStore("${RUN_STORE}");`
    + `o.runs.forEach(function(x){try{st.put(x)}catch(e){}});tx.oncomplete=tx.onerror=tx.onabort=function(){db.close();res()}}})}}catch(e){}`
    + `location.replace(to)})()</script></head><body></body></html>`;
  const response = new Response(html, { headers: htmlHeaders });
  for (const cookie of cookies) response.headers.append("Set-Cookie", cookie);
  return response;
}
