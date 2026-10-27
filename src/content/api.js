/**
 * Friend data access. All HTTP requests are routed through the shared
 * background scheduler; no content script fetches 42 endpoints directly.
 */
import { readFriendCache, saveFriendResource } from "./cache.js";

function toResult(friend, profile, logtime, error = null, stale = false, logtimeStale = false) {
    return {
        friend,
        friend_object: profile || {},
        log_time_object: logtime || {},
        unavailable: !profile,
        stale,
        error
    };
}

async function fetchRemote(friend, kind) {
    const response = await chrome.runtime.sendMessage({
        type: "42-friends:fetch",
        friend,
        login: friend,
        kind
    });
    if (!response || !response.ok) {
        const details = response?.error || { code: "network_error", message: "No response from extension" };
        const error = new Error(details.message || "Failed to load friend data");
        Object.assign(error, details);
        throw error;
    }
    if (!response.data || typeof response.data !== "object") {
        const error = new Error("Invalid 42 Intra data");
        error.code = "invalid_response";
        throw error;
    }
    return response.data;
}

/**
 * Last known snapshot for immediate rendering. Never discards expired data;
 * stale entries must be visually marked as such.
 */
export async function getFriendSnapshot(friend) {
    const cached = await readFriendCache(friend);
    if (!cached.profile && !cached.logtime) return null;
    return toResult(
        friend,
        cached.profile?.data,
        cached.logtime?.data,
        null,
        !cached.profile?.fresh,\n        !cached.logtime?.fresh
    );
}

/**
 * Refreshes only missing/expired resources. Successful profile responses
 * survive a subsequent logtime failure.
 */
export async function fetchFriendData(friend) {
    const cached = await readFriendCache(friend);
    let profile = cached.profile?.data;
    let logtime = cached.logtime?.data;
    let failure = null;\n    let profileFresh = Boolean(cached.profile?.fresh);\n    let logtimeFresh = Boolean(cached.logtime?.fresh);

    try {
        if (!cached.profile?.fresh) {
            profile = await fetchRemote(friend, "profile");
            await saveFriendResource(friend, "profile", profile);\n            profileFresh = true;
        }
        if (!cached.logtime?.fresh) {
            logtime = await fetchRemote(friend, "logtime");
            await saveFriendResource(friend, "logtime", logtime);\n            logtimeFresh = true;
        }
    } catch (error) {
        failure = {
            code: error.code || "network_error",
            message: error.message || "Request failed",
            cooldownUntil: error.cooldownUntil,
            retryAfterMs: error.retryAfterMs
        };
    }

    return toResult(friend, profile, logtime, failure, !profileFresh, !logtimeFresh);
}
