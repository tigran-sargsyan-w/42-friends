import test from "node:test";
import assert from "node:assert/strict";

const values = new Map();
let fetchCalls = [];
let limitUntil = 0;

globalThis.chrome = {
    storage: {
        local: {
            async get(keys) {
                const result = {};
                const list = keys === null ? [...values.keys()] : Array.isArray(keys) ? keys : [keys];
                for (const name of list) if (values.has(name)) result[name] = values.get(name);
                return result;
            },
            async set(items) {
                for (const [name, item] of Object.entries(items)) values.set(name, item);
            },
            async remove(keys) {
                for (const name of Array.isArray(keys) ? keys : [keys]) values.delete(name);
            }
        }
    },
    runtime: {
        async sendMessage(message) {
            assert.equal(message.type, "42-friends:budget");
            if (message.operation === "reserve")
                return Date.now() < limitUntil
                    ? { ok: true, blocked: true, cooldownUntil: limitUntil }
                    : { ok: true, blocked: false, at: Date.now() };
            if (message.operation === "check") return {
                ok: true, blocked: Date.now() < limitUntil, cooldownUntil: limitUntil
            };
            if (message.operation === "limited") {
                limitUntil = Date.now() + (message.retryAfterMs || 30000) + 5000;
                return { ok: true, cooldownUntil: limitUntil };
            }
            return { ok: true };
        }
    }
};

const { fetchFriendData, parseRetryAfter } = await import("../src/content/api.js");
const {
    getCachedFriendData, setCachedFriendData, markFriendCacheForRefresh,
    getFriendResourceState
} = await import("../src/content/cache.js");

test("Retry-After accepts seconds and HTTP dates", () => {
    assert.equal(parseRetryAfter("20", 0), 20000);
    assert.equal(parseRetryAfter("Wed, 21 Oct 2030 07:28:00 GMT",
        Date.parse("Wed, 21 Oct 2030 07:27:50 GMT")), 10000);
});

test("content script still uses the authenticated original 42 endpoints", async () => {
    values.clear(); limitUntil = 0; fetchCalls = [];
    globalThis.fetch = async (url, options) => {
        fetchCalls.push({ url, options });
        const data = fetchCalls.length === 1
            ? { login: "alice", location: "z1" }
            : { "2026-10-27": "04:30" };
        return new Response(JSON.stringify(data), { status: 200 });
    };
    const data = await fetchFriendData("alice");
    assert.equal(data.friend_object.location, "z1");
    assert.equal(data.log_time_object["2026-10-27"], "04:30");
    assert.deepEqual(fetchCalls.map(x => x.url), [
        "https://profile.intra.42.fr/users/alice",
        "https://translate.intra.42.fr/users/alice/locations_stats.json"
    ]);
    assert.ok(fetchCalls.every(x => x.options.credentials === "include"));
    const cached = await getCachedFriendData("alice");
    assert.equal(cached._stale, false);
    assert.equal(cached._logtimeStale, false);
});

test("reloads and refresh do not cause a new burst for fresh friends", async () => {
    fetchCalls = [];
    globalThis.fetch = async url => {
        fetchCalls.push(url);
        throw Error("Fresh friends must not be fetched");
    };
    await markFriendCacheForRefresh();
    const data = await fetchFriendData("alice");
    assert.equal(data.friend_object.location, "z1");
    assert.equal(fetchCalls.length, 0);
});

test("only expired logtime is fetched; profile remains fresh", async () => {
    values.clear(); limitUntil = 0; fetchCalls = [];
    await setCachedFriendData("bob", {
        friend: "bob", friend_object: { login: "bob", location: "z4" },
        log_time_object: { "2026-10-27": "02:10" }
    });
    values.get("tf_resource_logtime_bob").timestamp = Date.now() - 20 * 60 * 1000;
    globalThis.fetch = async (url, options) => {
        fetchCalls.push(url);
        return new Response('{"2026-10-27":"03:45"}', { status: 200 });
    };
    const result = await fetchFriendData("bob");
    assert.equal(result.friend_object.location, "z4");
    assert.equal(result.log_time_object["2026-10-27"], "03:45");
    assert.equal(fetchCalls.length, 1);
    assert.ok(fetchCalls[0].includes("locations_stats.json"));
});

test("429 shares Retry-After budget and does not issue an immediate retry", async () => {
    values.clear(); limitUntil = 0; let sent = 0;
    globalThis.fetch = async () => {
        sent++;
        return new Response("Too many search requests", {
            status: 429,
            headers: { "Retry-After": "20" }
        });
    };
    await assert.rejects(fetchFriendData("blocked"), { code: "rate_limited" });
    await assert.rejects(fetchFriendData("blocked2"), { code: "rate_limited" });
    assert.equal(sent, 1);
    assert.ok(limitUntil > Date.now() + 20000);
});
