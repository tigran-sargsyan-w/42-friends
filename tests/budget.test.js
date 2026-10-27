import test from "node:test";
import assert from "node:assert/strict";
import {
    RateBudget, MIN_INTERVAL_MS, COOLDOWN_MARGIN_MS
} from "../src/background/budget.js";

test("all tabs receive serialized request slots", () => {
    let time = 100000;
    const budget = new RateBudget({}, () => time);
    const slots = [budget.reserve().at, budget.reserve().at, budget.reserve().at];
    assert.deepEqual(slots, [
        time, time + MIN_INTERVAL_MS, time + 2 * MIN_INTERVAL_MS
    ]);
    time += MIN_INTERVAL_MS;
    assert.equal(budget.check().blocked, false);
});

test("429 pauses every tab and slows subsequent requests", () => {
    let time = 50000;
    const budget = new RateBudget({}, () => time);
    const pause = budget.limited(20000);
    assert.equal(pause.cooldownUntil, time + 20000 + COOLDOWN_MARGIN_MS);
    assert.equal(budget.reserve().blocked, true);
    assert.ok(budget.intervalMs > MIN_INTERVAL_MS);
    const restored = new RateBudget(budget.serialize(), () => time);
    assert.equal(restored.reserve().blocked, true);
    time = pause.cooldownUntil + 1;
    assert.equal(restored.reserve().blocked, false);
});

test("successful responses relax a previously restricted budget slowly", () => {
    const budget = new RateBudget({ intervalMs: 10000 }, () => 3000);
    for (let i = 0; i < 19; i++) budget.succeeded();
    assert.equal(budget.intervalMs, 10000);
    budget.succeeded();
    assert.equal(budget.intervalMs, 9000);
});
