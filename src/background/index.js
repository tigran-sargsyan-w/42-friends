/**
 * Single owner for the request budget across all open Intra tabs.
 * IMPORTANT: no fetch() here — only permission to start a request.
 * The real Intra request stays in the authenticated content-script context.
 */
import { RateBudget } from "./budget.js";

const STATE_KEY = "tf_rate_budget_v1";
const LEGACY_COOLDOWN_KEY = "tf_request_cooldown_until";

const ready = chrome.storage.local.get([STATE_KEY, LEGACY_COOLDOWN_KEY]).then(items => {
    const budget = new RateBudget(items[STATE_KEY]);
    budget.cooldownUntil = Math.max(
        budget.cooldownUntil, Number(items[LEGACY_COOLDOWN_KEY]) || 0
    );
    return budget;
});

// The message owner serializes reads/mutations/writes before acknowledging
// them, even when multiple content scripts send messages simultaneously.
let operations = Promise.resolve();
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || message.type !== "42-friends:budget") return false;
    if (!sender.tab || !sender.url?.startsWith("https://")) return false;
    const allowed = ["reserve", "check", "limited", "success"];
    if (!allowed.includes(message.operation)) return false;

    const work = operations.then(async () => {
        const budget = await ready;
        let result;
        switch (message.operation) {
            case "reserve": result = budget.reserve(); break;
            case "check": result = budget.check(); break;
            case "limited": result = budget.limited(message.retryAfterMs); break;
            case "success": result = budget.succeeded(); break;
        }
        if (message.operation !== "check") {
            await chrome.storage.local.set({ [STATE_KEY]: budget.serialize() });
        }
        return result;
    });
    operations = work.catch(() => {});
    work.then(
        response => sendResponse({ ok: true, ...response }),
        error => sendResponse({ ok: false, message: String(error.message || error) })
    );
    return true;
});
