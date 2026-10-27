/**
 * Authenticated 42 Intra requests remain in the content script, exactly
 * as in v0.1.5. The background component only schedules request starts;
 * it does NOT fetch or read the authenticated response.
 */
import { getCachedFriendData, getFriendResourceState, saveFriendResource } from "./cache.js";

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

async function budget(operation, extras = {}) {
    let result;
    try {
        result = await chrome.runtime.sendMessage({
            type: "42-friends:budget", operation, ...extras
        });
    } catch (error) {
        throw new FriendRequestError("scheduler_unavailable",
            "42 Friends request coordinator is unavailable");
    }
    if (!result?.ok) {
        throw new FriendRequestError("scheduler_unavailable",
            result?.message || "Request coordinator unavailable");
    }
    return result;
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function getCooldownUntil() {
    try {
        return (await budget("check")).cooldownUntil || 0;
    } catch {
        return 0;
    }
}

async function requestResource(login, kind) {
    let current = await getFriendResourceState(login);
    if (kind === "profile" && current.profileFresh) return current.profile;
    if (kind === "logtime" && current.logtimeFresh) return current.logtime;

    const slot = await budget("reserve");
    if (slot.blocked) {
        throw new FriendRequestError("rate_limited", "42 Intra requests are paused", {
            cooldownUntil: slot.cooldownUntil
        });
    }
    const delay = Math.max(0, (slot.at || Date.now()) - Date.now());
    if (delay) await sleep(delay);

    // If another tab refreshed this friend while we waited, reuse its data.
    current = await getFriendResourceState(login);
    if (kind === "profile" && current.profileFresh) return current.profile;
    if (kind === "logtime" && current.logtimeFresh) return current.logtime;

    const check = await budget("check");
    if (check.blocked) {
        throw new FriendRequestError("rate_limited", "42 Intra requests are paused", {
            cooldownUntil: check.cooldownUntil
        });
    }

    const encoded = encodeURIComponent(login);
    const url = kind === "profile"
        ? "https://profile.intra.42.fr/users/" + encoded
        : "https://translate.intra.42.fr/users/" + encoded + "/locations_stats.json";
    let response;
    try {
        response = await fetch(url, { credentials: "include" });
    } catch (error) {
        throw new FriendRequestError("network_error", error?.message || "Network request failed");
    }

    if (response.status === 429) {
        const retryAfterMs = parseRetryAfter(response.headers.get("Retry-After"));
        const pause = await budget("limited", { retryAfterMs });
        throw new FriendRequestError("rate_limited", "42 Intra rate limit reached", {
            cooldownUntil: pause.cooldownUntil
        });
    }
    if (response.status === 401 || response.status === 403) {
        throw new FriendRequestError("unauthorized", "Sign in to 42 Intra");
    }
    if (response.status === 404) {
        throw new FriendRequestError("not_found", "Friend not found");
    }
    if (!response.ok) {
        throw new FriendRequestError("http_error", "HTTP " + response.status, {
            status: response.status
        });
    }

    let data;
    try {
        data = await response.json();
        if (!data || typeof data !== "object" || Array.isArray(data)) {
            throw Error("Not a JSON object");
        }
    } catch {
        throw new FriendRequestError("invalid_response", "42 Intra returned invalid JSON");
    }

    await saveFriendResource(login, kind, data);
    // Fire-and-forget feedback; failure never means another HTTP request.
    void budget("success").catch(() => {});
    return data;
}

/**
 * Only missing/expired resources trigger HTTP. A profile may be displayed
 * immediately even when logtime is still pending.
 */
export async function fetchFriendData(login, onProgress = null) {
    let snapshot = await getCachedFriendData(login, { allowStale: true });
    let friendObject = snapshot?.friend_object || {};
    let logTimeObject = snapshot?.log_time_object || {};
    try {
        const initial = await getFriendResourceState(login);
        if (!initial.profileFresh) {
            friendObject = await requestResource(login, "profile");
            if (typeof onProgress === "function") {
                onProgress({
                    friend: login, friend_object: friendObject,
                    log_time_object: logTimeObject,
                    _stale: false, _logtimeStale: !initial.logtimeFresh
                });
            }
        }
        if (!initial.logtimeFresh) {
            logTimeObject = await requestResource(login, "logtime");
        }
        return {
            friend: login, friend_object: friendObject, log_time_object: logTimeObject,
            _stale: false, _logtimeStale: false
        };
    } catch (error) {
        const latest = await getCachedFriendData(login, { allowStale: true });
        if (latest) error.partial = latest;
        throw error;
    }
}
