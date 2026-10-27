import test from "node:test";
import assert from "node:assert/strict";

const memory = new Map();
globalThis.chrome = {
    storage: {
        local: {
            async get(keys) {
                const result = {};
                for (const key of Array.isArray(keys) ? keys : [keys]) {
                    if (memory.has(key)) result[key] = memory.get(key);
                }
                return result;
            },
            async set(data) {
                for (const [key, value] of Object.entries(data)) memory.set(key, value);
            }
        }
    },
    runtime: {
        async sendMessage(message) {
            if (message.operation === "reserve") return { ok: true, blocked: false, at: Date.now() };
            return { ok: true, blocked: false };
        }
    }
};
const { fetchFriendData } = await import("../src/content/api.js");
const { getFriendResourceState } = await import("../src/content/cache.js");

test("successful profile remains cached when logtime request fails", async () => {
    let requests = 0;
    globalThis.fetch = async () => {
        requests++;
        if (requests === 1) return new Response(
            '{"login":"testuser","location":"z1r1p1"}', { status: 200 }
        );
        return new Response("temporarily unavailable", { status: 503 });
    };
    const updates = [];
    await assert.rejects(fetchFriendData("testuser", value => updates.push(value)), error => {
        assert.equal(error.code, "http_error");
        assert.equal(error.partial.friend_object.location, "z1r1p1");
        assert.equal(error.partial._stale, false);
        return true;
    });
    assert.equal(updates.length, 1);
    assert.equal(requests, 2);
    const state = await getFriendResourceState("testuser");
    assert.equal(state.profileFresh, true);
    assert.equal(state.logtimeFresh, false);
});
