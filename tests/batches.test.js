import test from "node:test";
import assert from "node:assert/strict";
import { loadInBatches } from "../src/content/batches.js";

test("at most two friends request data concurrently; request pacing is global", async () => {
    let concurrency = 0;
    let maximum = 0;
    const seen = [];
    const result = await loadInBatches({
        friends: Array.from({ length: 31 }, (_, i) => "u" + i),
        batchSize: 2, gapMs: 0,
        load: async friend => {
            concurrency++;
            maximum = Math.max(concurrency, maximum);
            await Promise.resolve();
            concurrency--;
            return { friend };
        },
        onResult: (friend, value) => seen.push(value.friend)
    });
    assert.equal(maximum, 2);
    assert.equal(seen.length, 31);
    assert.equal(result.stopped, null);
});

test("429 preserves pending work and pauses before next batch", async () => {
    const requested = [];
    const deadline = Date.now() + 20000;
    const outcome = await loadInBatches({
        friends: ["alice", "bob", "carol", "dave"],
        batchSize: 2, gapMs: 0,
        load: async friend => {
            requested.push(friend);
            if (friend === "alice") throw Object.assign(new Error("rate limit"), {
                code: "rate_limited", cooldownUntil: deadline
            });
            return { friend };
        },
        onResult: () => {}
    });
    assert.deepEqual(requested, ["alice", "bob"]);
    assert.equal(outcome.stopped, "rate_limited");
    assert.deepEqual(outcome.remaining, ["alice", "carol", "dave"]);
});

test("scheduler unavailable stops an entire burst instead of repeating failures", async () => {
    let count = 0;
    const result = await loadInBatches({
        friends: Array.from({ length: 31 }, (_, i) => String(i)),
        batchSize: 2, gapMs: 0,
        load: async () => {
            count++;
            throw Object.assign(new Error("No scheduler"), { code: "scheduler_unavailable" });
        },
        onResult: () => {}
    });
    assert.equal(count, 2);
    assert.equal(result.stopped, "scheduler_unavailable");
    assert.equal(result.remaining.length, 29);
});
