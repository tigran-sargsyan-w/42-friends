/**
 * Fetch 42 Intra data in the SAME content-script context as v0.1.5.
 * No background service worker requests: those broke authenticated requests.
 */
import { getCachedFriendData, setCachedFriendData } from "./cache.js";

export function parseRetryAfter(value, now = Date.now()) {
    if (!value) return null;
    const trimmed = String(value).trim();
    if (/^\d+$/.test(trimmed)) return Math.max(0, Number(trimmed) * 1000);
    const parsed = Date.parse(trimmed);
    return Number.isFinite(parsed) ? Math.max(0, parsed - now) : null;
}

export class FriendRequestError extends Error {
    constructor(code, message, details = {}) {
        super(message);
        this.name = "FriendRequestError";
        this.code = code;
        Object.assign(this, details);
    }
}

const COOLDOWN_KEY = "tf_request_cooldown_until";
let localCooldown = 0;

/** Shared across Intra tabs via chrome.storage.local. */
export async function getCooldownUntil() {
    try {
        const stored = await chrome.storage.local.get(COOLDOWN_KEY);
        return Math.max(localCooldown, Number(stored[COOLDOWN_KEY]) || 0);
    } catch {
        return localCooldown;
    }
}

async function updateCooldown(until) {
    localCooldown = Math.max(localCooldown, until);
    try {
        await chrome.storage.local.set({ [COOLDOWN_KEY]: localCooldown });
    } catch (error) {
        console.warn("42 Friends: failed to save rate-limit cooldown", error);
    }
}

async function requestJson(url) {
    const until = await getCooldownUntil();
    if (Date.now() < until) {
        throw new FriendRequestError("rate_limited", "42 Intra requests are temporarily paused", {
            cooldownUntil: until
        });
    }

    let response;
    try {
        response = await fetch(url, { credentials: "include" });
    } catch (error) {
        throw new FriendRequestError("network_error", error?.message || "Network request failed");
    }

    if (response.status === 429) {
        const delay = parseRetryAfter(response.headers.get("Retry-After")) ?? 30000;
        const cooldownUntil = Date.now() + Math.max(1000, delay);
        await updateCooldown(cooldownUntil);
        throw new FriendRequestError("rate_limited", "42 Intra rate limit reached", {
            cooldownUntil
        });
    }
    if (response.status === 401 || response.status === 403) {
        throw new FriendRequestError("unauthorized", "Sign in to 42 Intra");
    }
    if (response.status === 404) {
        throw new FriendRequestError("not_found", "Friend not found");
    }
    if (!response.ok) {
        throw new FriendRequestError("http_error", `HTTP ${response.status}`, {
            status: response.status
        });
    }
    // Keep original behavior: 42 endpoints can return JSON without the
    // expected Content-Type header. Verify the actual response instead.
    try {
        const data = await response.json();
        if (!data || typeof data !== "object" || Array.isArray(data)) {
            throw new Error("Invalid JSON object");
        }
        return data;
    } catch {
        throw new FriendRequestError("invalid_response", "42 Intra returned invalid JSON");
    }
}

/**
 * Reuses the exact original profile + logtime endpoints and credential handling.
 * Cached values are returned while fresh; the expired snapshot is kept as a
 * fallback but is NOT misrepresented as freshly fetched data.
 */
export async function fetchFriendData(friend) {
    const cached = await getCachedFriendData(friend);
    if (cached) return cached;

    const old = await getCachedFriendData(friend, { allowStale: true });
    let friendObject;
    try {
        friendObject = await requestJson(`https://profile.intra.42.fr/users/${encodeURIComponent(friend)}`);
        const logTimeObject = await requestJson(
            `https://translate.intra.42.fr/users/${encodeURIComponent(friend)}/locations_stats.json`
        );
        const data = { friend, friend_object: friendObject, log_time_object: logTimeObject };
        await setCachedFriendData(friend, data);
        return data;
    } catch (error) {
        // Preserve a successful profile if the second (logtime) call fails.
        if (friendObject && error && typeof error === "object") {
            error.partial = {
                friend,
                friend_object: friendObject,
                log_time_object: old?.log_time_object || {}
            };
        }
        throw error;
    }
}
