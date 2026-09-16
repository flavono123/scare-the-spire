import assert from "node:assert/strict";
import { parseDetailShellTarget } from "../workers/detail-shell-og";

// Default locale routes
const historyTarget = parseDetailShellTarget("/history-course/c167-20260901-abcd");
assert.deepEqual(historyTarget, {
  service: "history-course",
  recordId: "c167-20260901-abcd",
  gameLocale: "",
});

const comboTarget = parseDetailShellTarget("/c-c-c-combo/test-post-uuid");
assert.deepEqual(comboTarget, {
  service: "c-c-c-combo",
  recordId: "test-post-uuid",
  gameLocale: "",
});

const chemicalTarget = parseDetailShellTarget("/chemical-x/test-post-uuid");
assert.deepEqual(chemicalTarget, {
  service: "chemical-x",
  recordId: "test-post-uuid",
  gameLocale: "",
});

const thisOrThatTarget = parseDetailShellTarget("/this-or-that/test-post-uuid");
assert.deepEqual(thisOrThatTarget, {
  service: "this-or-that",
  recordId: "test-post-uuid",
  gameLocale: "",
});

const transfigureTarget = parseDetailShellTarget("/transfigure/test-post-uuid");
assert.deepEqual(transfigureTarget, {
  service: "transfigure",
  recordId: "test-post-uuid",
  gameLocale: "",
});

const decisionsTarget = parseDetailShellTarget("/decisions-decisions/test-post-uuid");
assert.deepEqual(decisionsTarget, {
  service: "decisions-decisions",
  recordId: "test-post-uuid",
  gameLocale: "",
});

// English locale routes
const enHistoryTarget = parseDetailShellTarget("/en/history-course/c167-20260901-abcd");
assert.deepEqual(enHistoryTarget, {
  service: "history-course",
  recordId: "c167-20260901-abcd",
  gameLocale: "en",
});

const enComboTarget = parseDetailShellTarget("/en/c-c-c-combo/test-post-uuid");
assert.deepEqual(enComboTarget, {
  service: "c-c-c-combo",
  recordId: "test-post-uuid",
  gameLocale: "en",
});

// Federated defragment routes
const defragCombo = parseDetailShellTarget("/defragment/combo/test-post-uuid");
assert.deepEqual(defragCombo, {
  service: "defragment-combo",
  recordId: "test-post-uuid",
  gameLocale: "",
});

// Placeholder __id__ must return null
assert.equal(parseDetailShellTarget("/history-course/__id__"), null);
assert.equal(parseDetailShellTarget("/en/history-course/__id__"), null);
assert.equal(parseDetailShellTarget("/c-c-c-combo/__id__"), null);

// Non-shell routes must return null
assert.equal(parseDetailShellTarget("/history-course"), null);
assert.equal(parseDetailShellTarget("/compendium/cards/strike"), null);
assert.equal(parseDetailShellTarget("/patches/0.100.0"), null);

// Test enrichShellHtml handler registrations and attribute updates
interface MockElement {
  setInnerContent?(content: string): void;
  setAttribute?(name: string, value: string): void;
}

const registeredSelectors: string[] = [];
const registeredHandlers = new Map<string, (el: MockElement) => void>();

class TestHTMLRewriter {
  on(selector: string, handlers: { element?(el: MockElement): void }) {
    registeredSelectors.push(selector);
    if (handlers.element) {
      registeredHandlers.set(selector, handlers.element);
    }
    return this;
  }
  transform(response: Response) {
    return response;
  }
}

Object.assign(globalThis, { HTMLRewriter: TestHTMLRewriter });

async function main() {
  const { enrichShellHtml } = await import("../workers/detail-shell-og");

  const dummyResponse = new Response("<html><head><title>old</title></head><body></body></html>", {
    headers: { "Content-Type": "text/html; charset=utf-8", "x-cf-static-page": "shell" },
  });

  const ogData = {
    title: "50층 보스 격파! - 슬서운 이야기 역사 강의서",
    description: "시드 런 리플레이",
    image: "https://scare-the-spire.com/images/sts2/cards/bash.webp",
    url: "https://scare-the-spire.com/history-course/my-run-123",
  };

  const resultResponse = enrichShellHtml(dummyResponse, ogData);
  assert.equal(resultResponse.headers.get("x-cf-static-page"), "shell");

  // Verify all essential OG selectors were attached
  assert.ok(registeredSelectors.includes("title"));
  assert.ok(registeredSelectors.includes('meta[property="og:title"]'));
  assert.ok(registeredSelectors.includes('meta[name="twitter:title"]'));
  assert.ok(registeredSelectors.includes('meta[property="og:description"]'));
  assert.ok(registeredSelectors.includes('meta[name="twitter:description"]'));
  assert.ok(registeredSelectors.includes('meta[property="og:image"]'));
  assert.ok(registeredSelectors.includes('meta[name="twitter:image"]'));
  assert.ok(registeredSelectors.includes('meta[property="og:url"]'));
  assert.ok(registeredSelectors.includes('link[rel="canonical"]'));

  // Verify element mutations
  let titleContent = "";
  registeredHandlers.get("title")?.({
    setInnerContent(c: string) {
      titleContent = c;
    },
  });
  assert.equal(titleContent, ogData.title);

  let ogTitle = "";
  registeredHandlers.get('meta[property="og:title"]')?.({
    setAttribute(attr: string, val: string) {
      if (attr === "content") ogTitle = val;
    },
  });
  assert.equal(ogTitle, ogData.title);

  let ogImage = "";
  registeredHandlers.get('meta[property="og:image"]')?.({
    setAttribute(attr: string, val: string) {
      if (attr === "content") ogImage = val;
    },
  });
  assert.equal(ogImage, ogData.image);

  let canonicalHref = "";
  registeredHandlers.get('link[rel="canonical"]')?.({
    setAttribute(attr: string, val: string) {
      if (attr === "href") canonicalHref = val;
    },
  });
  assert.equal(canonicalHref, ogData.url);

  console.log("detail-shell-og.spec.ts ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
