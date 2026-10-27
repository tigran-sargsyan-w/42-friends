import test from "node:test";
import assert from "node:assert/strict";

const db = new Map();
let handler = async () => ({ ok: true, data: {} });

globalThis.chrome = {
    storage: {
        local: {
            async get(keys) {
                const result = {};
                for (const key of (keys === null ? [...db.keys()] : Array.isArray(keys) ? keys : [keys])) {
                    if (db.has(key)) result[key] = db.get(key);
                }
                return result;
            },
            async set(entries) {
                for (const [key, value] of Object.entries(entries)) db.set(key, value);
            },
            async remove(keys) {
                for (const key of (Array.isArray(keys) ? keys : [keys])) db.delete(key);
            }
        }
    },
    runtime: {
        async sendMessage(message) { return handler(message); }
    }
};

const { readFriendCache, saveFriendResource, clearFriendCache } = await import("../src/content/cache.js");
const { fetchFriendData, getFriendSnapshot } = await import("../src/content/api.js");

test("separate profile and logtime cache survive independent writes", async () => {
    db.clear();
    await saveFriendResource("alice", "profile", { location: "z1r1p2" });
    await saveFriendResource("alice", "logtime", { today: "02:30" });
    const cached = await readFriendCache("alice");
    assert.equal(cached.profile.data.location, "z1r1p2");
    assert.equal(cached.logtime.data.today, "02:30");
    assert.equal(cached.profile.fresh, true);
});

test("version 0.1.5 cache remains readable as stale fallback", async () => {
    db.clear();
    db.set("friend_cache_legacy", {
        timestamp: Date.now() - 600000,
        data: {
            friend_object: { login: "legacy", location: "z2" },
            log_time_object: { today: "01:00" }
        }
    });
    const snapshot = await getFriendSnapshot("legacy");
    assert.equal(snapshot.friend_object.login, "legacy");
    assert.equal(snapshot.stale, true);
});

test("rate limit preserves cached profile, never empties the friend", async () => {
    db.clear();
    db.set("friend_cache_bob", {
        timestamp: Date.now() - 600000,
        data: {
            friend_object: { login: "bob", location: "z4" },
            log_time_object: {}
        }
    });
    handler = async () => ({
        ok: false,
        error: { code: "rate_limited", retryAfterMs: 20000, cooldownUntil: Date.now() + 20000 }
    });
    const result = await fetchFriendData("bob");
    assert.equal(result.friend_object.login, "bob");
    assert.equal(result.stale, true);
    assert.equal(result.error.code, "rate_limited");
    assert.equal(db.has("friend_cache_bob"), true);
});

test("profile stays cached if logtime endpoint fails", async () => {
    db.clear();
    handler = async ({ kind }) => kind === "profile"
        ? { ok: true, data: { login: "carol", location: null } }
        : { ok: false, error: { code: "http_error", message: "Server error" } };
    const result = await fetchFriendData("carol");
    assert.equal(result.friend_object.login, "carol");
    assert.equal(result.error.code, "http_error");
    const cached = await readFriendCache("carol");
    assert.equal(cached.profile.data.login, "carol");
    assert.equal(cached.logtime, null);
});

test("clearing one removed friend's cache leaves others intact", async () => {
    db.clear();
    await saveFriendResource("alice", "profile", { login: "alice" });
    await saveFriendResource("bob", "profile", { login: "bob" });
    await clearFriendCache("alice");
    assert.equal((await readFriendCache("alice")).profile, null);
    assert.equal((await readFriendCache("bob")).profile.data.login, "bob");
});
