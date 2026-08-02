import assert from "node:assert/strict";
import {
  changeThisOrThatVoteSummary,
  thisOrThatVotePercentage,
} from "../src/lib/this-or-that-votes";

const initial = { leftCount: 3, rightCount: 1, totalCount: 4 };
const voted = changeThisOrThatVoteSummary(initial, "right", 1);

assert.deepEqual(voted, { leftCount: 3, rightCount: 2, totalCount: 5 });
assert.equal(thisOrThatVotePercentage(voted, "left"), 60);
assert.equal(thisOrThatVotePercentage(voted, "right"), 40);
assert.deepEqual(
  changeThisOrThatVoteSummary({ leftCount: 0, rightCount: 0, totalCount: 0 }, "left", -1),
  { leftCount: 0, rightCount: 0, totalCount: 0 },
);

console.log("This-or-that vote tests passed.");
