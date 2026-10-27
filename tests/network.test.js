import test from "node:test";
import assert from "node:assert/strict";

const values = new Map();
globalThis.chrome = {
    storage: {
        local: {
            async get(keys) {
                const result = {};
                const names = keys === null ? [...values.keys()] : Array.isArray(keys) ? keys : [keys];
                for (const key of names) if (values.has(key)) result[key] = values.get(key);
                return result;
            },
            async set(items) { for (const [key, value] of Object.entries(items)) values.set(key, value); },
            async remove(names) {
                for (const name of Array.isArray(names) ? names : [names]) values.delete(name);
            }
        }
    }
};

const { fetchFriendData, parseRetryAfter, getCooldownUntil } = await import("../src/content/api.js");
const { getCachedFriendData, setCachedFriendData, markFriendCacheForRefresh } =
    await import("../src/content/cache.js");

test("Retry-After parses seconds and HTTP dates", () => {
    assert.equal(parseRetryAfter("20", 0), 20000);
    assert.equal(parseRetryAfter("Wed, 21 Oct 2030 07:28:00 GMT",
        Date.parse("Wed, 21 Oct 2030 07:27:50 GMT")), 10000);
    assert.equal(parseRetryAfter("invalid", 0), null);
});

test("original endpoints and content-script credentials are preserved", async () => {
    values.clear();
    const urls = [];
    globalThis.fetch = async (url, options) => {
        urls.push({ url, options });
        return new Response(JSON.stringify(
            urls.length === 1 ? { login: "alice", location: "z1" } : { "2026-10-27": "04:30" }
        ), { status: 200 });
    };
    const data = await fetchFriendData("alice");
    assert.equal(data.friend_object.location, "z1");
    assert.equal(data.log_time_object["2026-10-27"], "04:30");
    assert.deepEqual(urls.map(x => x.url), [
        "https://profile.intra.42.fr/users/alice",
        "https://translate.intra.42.fr/users/alice/locations_stats.json"
    ]);
    assert.ok(urls.every(x => x.options.credentials === "include"));
    assert.deepEqual(await getCachedFriendData("alice"), data);
});

test("fresh cache avoids requests; manual refresh never deletes cached data", async () => {
    values.clear();
    const entry = { friend: "bob", friend_object: { location: null }, log_time_object: {} };
    await setCachedFriendData("bob", entry);
    globalThis.fetch = async () => { throw Error("should not fetch"); };
    assert.deepEqual(await fetchFriendData("bob"), entry);
    await markFriendCacheForRefresh(0);
    assert.equal(await getCachedFriendData("bob"), null);
    assert.deepEqual(await getCachedFriendData("bob", { allowStale: true }), entry);
});

test("429 sets a shared cooldown and does not retry", async () => {
    values.clear();
    let calls = 0;
    globalThis.fetch = async () => {
        calls++;
        return new Response("Too many search requests", {
            status: 429,
            headers: { "Retry-After": "20", "Content-Type": "text/plain" }
        });
    };
    const before = Date.now();
    await assert.rejects(fetchFriendData("blocked"), error =>
        error.code === "rate_limited" && error.cooldownUntil >= before + 20000);
    await assert.rejects(fetchFriendData("another"), { code: "rate_limited" });
    assert.equal(calls, 1);
    assert.ok(await getCooldownUntil() >= before + 20000);
});

