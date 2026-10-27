import test from "node:test";
import assert from "node:assert/strict";

const storage = new Map();
globalThis.chrome = {
    storage: {
        local: {
            async get(key) {
                const result = {};
                if (storage.has(key)) result[key] = storage.get(key);
                return result;
            },
            async set(values) {
                for (const [key, value] of Object.entries(values)) storage.set(key, value);
            }
        }
    }
};
const { fetchFriendData } = await import("../src/content/api.js");

test("successful profile remains available when logtime fails", async () => {
    let calls = 0;
    globalThis.fetch = async () => {
        calls++;
        if (calls === 1) {
            return new Response('{"login":"testuser","location":"z1r1p1"}', { status: 200 });
        }
        return new Response("unavailable", { status: 503 });
    };
    await assert.rejects(fetchFriendData("testuser"), error => {
        assert.equal(error.code, "http_error");
        assert.equal(error.partial.friend_object.location, "z1r1p1");
        assert.deepEqual(error.partial.log_time_object, {});
        return true;
    });
    assert.equal(calls, 2);
});
