import assert from "node:assert/strict";
import { isDatabaseRejection, submitDefragmentPost } from "../src/lib/defragment-submit";
import { overlayBodyForSave } from "../src/hooks/use-defragment-bodies";

const post = { id: "post-1" };

function deps(overrides: Partial<Parameters<typeof submitDefragmentPost<typeof post>>[0]> = {}) {
  const calls = { insert: 0, overlay: 0 };
  return {
    calls,
    input: {
      overlayInvalid: false,
      resolveUserId: async () => "user-1",
      insertPost: async () => {
        calls.insert += 1;
        return post;
      },
      saveOverlay: async () => {
        calls.overlay += 1;
      },
      ...overrides,
    },
  };
}

async function run() {
  // A bad overlay stops before anything is written.
  {
    const { calls, input } = deps({ overlayInvalid: true });
    assert.deepEqual(await submitDefragmentPost(input), { kind: "overlay-invalid" });
    assert.deepEqual(calls, { insert: 0, overlay: 0 });
  }

  // Saved post and overlay.
  {
    const { calls, input } = deps();
    assert.deepEqual(await submitDefragmentPost(input), { kind: "saved", post });
    assert.deepEqual(calls, { insert: 1, overlay: 1 });
  }

  // No user, a thrown 5xx, a check violation, and a refused insert all leave no post.
  {
    const { calls, input } = deps({ resolveUserId: async () => null });
    assert.deepEqual(await submitDefragmentPost(input), { kind: "post-failed", rejected: false });
    assert.equal(calls.insert, 0);
  }
  {
    const { calls, input } = deps({
      insertPost: async () => {
        throw { code: "PGRST000", message: "upstream" };
      },
    });
    assert.deepEqual(await submitDefragmentPost(input), { kind: "post-failed", rejected: false });
    assert.equal(calls.overlay, 0);
  }
  {
    const { input } = deps({
      insertPost: async () => {
        throw { code: "23514", message: "violates check" };
      },
    });
    assert.deepEqual(await submitDefragmentPost(input), { kind: "post-failed", rejected: true });
  }
  {
    const { input } = deps({ insertPost: async () => null });
    assert.deepEqual(await submitDefragmentPost(input), { kind: "post-failed", rejected: true });
  }

  // An overlay failure keeps the post, so the panel retries only the overlay.
  {
    const { calls, input } = deps({
      saveOverlay: async () => {
        throw { code: "23514", message: "defragment_bodies_content_text_check" };
      },
    });
    assert.deepEqual(await submitDefragmentPost(input), {
      kind: "overlay-failed",
      post,
      activeUserId: "user-1",
      rejected: true,
    });
    assert.equal(calls.insert, 1);
  }
  {
    const { input } = deps({
      saveOverlay: async () => {
        throw new TypeError("Failed to fetch");
      },
    });
    assert.deepEqual(await submitDefragmentPost(input), {
      kind: "overlay-failed",
      post,
      activeUserId: "user-1",
      rejected: false,
    });
  }

  assert.equal(isDatabaseRejection({ code: "23514" }), true);
  assert.equal(isDatabaseRejection({ code: "23505" }), true);
  assert.equal(isDatabaseRejection({ code: "42501" }), true);
  assert.equal(isDatabaseRejection({ code: "PGRST000" }), false);
  assert.equal(isDatabaseRejection(new Error("timed out")), false);
  assert.equal(isDatabaseRejection(null), false);

  // Empty, one character, and valid overlays.
  const text = (value: string) => [{ type: "text", text: value }] as never;
  assert.equal(overlayBodyForSave([]), null);
  assert.equal(overlayBodyForSave(text("x")), "invalid");
  assert.notEqual(overlayBodyForSave(text("xy")), "invalid");

  console.log("defragment-submit spec passed");
}

void run();
