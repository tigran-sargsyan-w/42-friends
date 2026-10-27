import test from "node:test";
import assert from "node:assert/strict";
import { loadInBatches } from "../src/content/batches.js";

test("runs three friends per group, with no per-request 1.8s sleep", async () => {
    let inFlight = 0;
    let maximum = 0;
    const groups = [];
    const received = [];
    const list = Array.from({ length: 31 }, (_, i) => "u" + i);
    const result = await loadInBatches({
        friends: list,
        batchSize: 3,
        gapMs: 1000,
        delay: async time => { groups.push(time); },
        load: async friend => {
            inFlight++;
            maximum = Math.max(maximum, inFlight);
            await Promise.resolve();
            inFlight--;
            return { friend };
        },
        onResult: (name, data) => received.push([name, data.friend])
    });
    assert.equal(maximum, 3);
    assert.equal(received.length, 31);
    assert.equal(groups.length, 10);
    assert.ok(groups.every(x => x === 1000));
    assert.equal(result.stopped, null);
});

test("429 pauses after current small batch and retains unfinished friends", async () => {
    const requested = [];
    const until = Date.now() + 20000;
    const outcome = await loadInBatches({
        friends: ["alice", "bob", "carol", "dave", "eve"],
        batchSize: 2,
        gapMs: 0,
        load: async name => {
            requested.push(name);
            if (name === "alice") throw Object.assign(new Error("rate limit"), {
                code: "rate_limited", cooldownUntil: until
            });
            return { friend: name };
        },
        onResult: () => {}
    });
    assert.deepEqual(requested, ["alice", "bob"]);
    assert.equal(outcome.stopped, "rate_limited");
    assert.equal(outcome.rateLimitedUntil, until);
    assert.deepEqual(outcome.remaining, ["alice", "carol", "dave", "eve"]);
});

test("a broken session fails fast rather than making 31 requests", async () => {
    let count = 0;
    const result = await loadInBatches({
        friends: Array.from({ length: 31 }, (_, i) => String(i)),
        batchSize: 3,
        gapMs: 0,
        load: async () => {
            count++;
            throw Object.assign(new Error("No session"), { code: "unauthorized" });
        },
        onResult: () => {}
    });
    assert.equal(count, 3);
    assert.equal(result.stopped, "unauthorized");
    assert.equal(result.remaining.length, 28);
});
