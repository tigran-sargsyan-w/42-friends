import test from "node:test";
import assert from "node:assert/strict";

const values = new Map();
let listener;
const storage = {
    async get(keys) {
        const result = {};
        for (const key of Array.isArray(keys) ? keys : [keys]) {
            if (values.has(key)) result[key] = values.get(key);
        }
        return result;
    },
    async set(items) {
        for (const [key, value] of Object.entries(items)) values.set(key, value);
    }
};
globalThis.chrome = {
    storage: { local: storage },
    runtime: { onMessage: { addListener(cb) { listener = cb; } } }
};

// In this test the background worker NEVER has fetch() available.
// It must only hand out request-start times to authenticated content scripts.
globalThis.fetch = () => { throw new Error("Network must never run in background"); };
await import("../src/background/index.js");

function send(operation, extra = {}, tab = 1) {
    return new Promise((resolve, reject) => {
        const accepted = listener({
            type: "42-friends:budget", operation, ...extra
        }, { tab: { id: tab } }, resolve);
        if (!accepted) reject(new Error("budget listener refused message"));
    });
}

test("simultaneous tabs receive globally spaced slots and shared cooldown", async () => {
    const [first, second, third] = await Promise.all([
        send("reserve", {}, 1),
        send("reserve", {}, 2),
        send("reserve", {}, 3)
    ]);
    assert.ok(first.ok && second.ok && third.ok);
    assert.ok(second.at - first.at >= 3000);
    assert.ok(third.at - second.at >= 3000);

    const limited = await send("limited", { retryAfterMs: 20000 }, 1);
    assert.equal(limited.blocked, true);
    const otherTab = await send("reserve", {}, 3);
    assert.equal(otherTab.blocked, true);
    assert.equal(otherTab.cooldownUntil, limited.cooldownUntil);
    const persisted = values.get("tf_rate_budget_v1");
    assert.equal(persisted.cooldownUntil, limited.cooldownUntil);
});
