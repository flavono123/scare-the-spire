import assert from "node:assert/strict";
import { contactReplyIsUnseen } from "../src/lib/contact-inquiries";

assert.equal(contactReplyIsUnseen({ admin_response: "답변", reply_seen_at: null }), true);
assert.equal(contactReplyIsUnseen({ admin_response: "답변", reply_seen_at: "2026-09-23T00:00:00Z" }), false);
assert.equal(contactReplyIsUnseen({ admin_response: null, reply_seen_at: null }), false);
assert.equal(contactReplyIsUnseen({}), false);

console.log("contact-reply-notice.spec.ts: ok");
