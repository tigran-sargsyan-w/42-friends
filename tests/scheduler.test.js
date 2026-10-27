import test from "node:test";
import assert from "node:assert/strict";
import { parseRetryAfter, RequestScheduler } from "../src/background/scheduler.js";

function jsonResponse(data, status = 200, headers = {}) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json", ...headers }
    });
}

test("Retry-After supports seconds and HTTP dates", () => {
    assert.equal(parseRetryAfter("20", 0), 20000);
    assert.equal(parseRetryAfter("Wed, 21 Oct 2030 07:28:00 GMT", Date.parse("Wed, 21 Oct 2030 07:27:50 GMT")), 10000);
    assert.equal(parseRetryAfter("bad", 0), null);
});

test("parallel callers share a single HTTP request", async () => {
    let calls = 0;
    const scheduler = new RequestScheduler({
        fetchImpl: async () => { calls++; return jsonResponse({ login: "test" }); },
        minIntervalMs: 0
    });
    const [a, b] = await Promise.all([scheduler.request("https://example.org/a"), scheduler.request("https://example.org/a")]);
    assert.deepEqual(a, b);
    assert.equal(calls, 1);
});

test("requests are paced and serialized", async () => {
    let clock = 1000;
    const timestamps = [];
    const scheduler = new RequestScheduler({
        now: () => clock,
        wait: async ms => { clock += ms; },
        minIntervalMs: 1500,
        fetchImpl: async url => {
            timestamps.push({ url, time: clock });
            return jsonResponse({ ok: true });
        }
    });
    await Promise.all(["a", "b", "c"].map(name => scheduler.request(name)));
    assert.deepEqual(timestamps.map(entry => entry.time), [1000, 2500, 4000]);
});

test("429 pauses the entire queue and persists Retry-After", async () => {
    let clock = 1000;
    let calls = 0;
    let stored = null;
    const scheduler = new RequestScheduler({
        now: () => clock,
        minIntervalMs: 0,
        persistCooldown: async until => { stored = until; },
        fetchImpl: async () => {
            calls++;
            return new Response("Too many search requests", {
                status: 429,
                headers: { "Retry-After": "20", "Content-Type": "text/plain" }
            });
        }
    });
    const responses = await Promise.allSettled([scheduler.request("a"), scheduler.request("b"), scheduler.request("c")]);
    assert.equal(calls, 1);
    assert.equal(stored, 21000);
    for (const response of responses) {
        assert.equal(response.status, "rejected");
        assert.equal(response.reason.code, "rate_limited");
        assert.equal(response.reason.retryAfterMs, 20000);
    }
    await assert.rejects(scheduler.request("d"), { code: "rate_limited" });
    assert.equal(calls, 1);
    clock = 21000;
    // Later requests may resume once the cooldown expires.
    await assert.rejects(scheduler.request("e"), { code: "rate_limited" });
    assert.equal(calls, 2);
});

test("server errors, authorization errors and non-JSON responses are distinguishable", async () => {
    const responses = [
        new Response("forbidden", { status: 403 }),
        new Response("error", { status: 503 }),
        new Response("html", { status: 200, headers: { "Content-Type": "text/html" } })
    ];
    const scheduler = new RequestScheduler({
        minIntervalMs: 0,
        fetchImpl: async () => responses.shift()
    });
    await assert.rejects(scheduler.request("a"), { code: "unauthorized" });
    await assert.rejects(scheduler.request("b"), { code: "http_error", status: 503 });
    await assert.rejects(scheduler.request("c"), { code: "invalid_response" });
});
