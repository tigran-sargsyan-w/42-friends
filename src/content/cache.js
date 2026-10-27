/**
 * v0.1.5 cached data is still valid. Profile and logtime are now separately
 * timestamped so a logtime refresh never forces an unnecessary profile fetch.
 */
import { CACHE_KEY_PREFIX } from "./constants.js";

const storage = chrome.storage.local;
export const PROFILE_TTL_MS = 4 * 60 * 1000;
export const LOGTIME_TTL_MS = 15 * 60 * 1000;

function legacyKey(login) { return CACHE_KEY_PREFIX + login; }
function resourceKey(login, kind) { return "tf_resource_" + kind + "_" + login; }

function entry(data, timestamp) {
    return data && typeof data === "object" && !Array.isArray(data) &&
        Number.isFinite(timestamp) ? { data, timestamp } : null;
}

export async function getFriendResourceState(login) {
    const keys = [legacyKey(login), resourceKey(login, "profile"),
        resourceKey(login, "logtime")];
    const saved = await storage.get(keys);
    const legacy = saved[legacyKey(login)];
    const profile = saved[resourceKey(login, "profile")] ||
        entry(legacy?.data?.friend_object, legacy?.timestamp);
    const logtime = saved[resourceKey(login, "logtime")] ||
        entry(legacy?.data?.log_time_object, legacy?.timestamp);
    const now = Date.now();
    return {
        profile: profile?.data || null,
        logtime: logtime?.data || null,
        profileFresh: !!profile && now - profile.timestamp < PROFILE_TTL_MS,
        logtimeFresh: !!logtime && now - logtime.timestamp < LOGTIME_TTL_MS
    };
}

export async function getCachedFriendData(login, { allowStale = false } = {}) {
    const cache = await getFriendResourceState(login);
    if (!cache.profile && !cache.logtime) return null;
    if (!allowStale && (!cache.profileFresh || !cache.logtimeFresh)) return null;
    return {
        friend: login,
        friend_object: cache.profile || {},
        log_time_object: cache.logtime || {},
        _stale: !cache.profileFresh,
        _logtimeStale: !cache.logtimeFresh
    };
}

export async function isFriendCacheFresh(login) {
    const state = await getFriendResourceState(login);
    return state.profileFresh && state.logtimeFresh;
}

export async function saveFriendResource(login, kind, data) {
    if (!["profile", "logtime"].includes(kind)) throw Error("Unknown cache kind");
    await storage.set({
        [resourceKey(login, kind)]: { data, timestamp: Date.now() }
    });
}

// Retain v0.1.5 API for compatibility and testing.
export async function setCachedFriendData(login, data) {
    const timestamp = Date.now();
    await storage.set({
        [legacyKey(login)]: { data, timestamp },
        [resourceKey(login, "profile")]: { data: data.friend_object, timestamp },
        [resourceKey(login, "logtime")]: { data: data.log_time_object, timestamp }
    });
}

/**
 * Manual refresh never deletes any data and never triggers a full burst of
 * 31 users. Fresh entries remain fresh even after repeated clicks.
 */
export async function markFriendCacheForRefresh() {
    // A normal render automatically refreshes expired entries.
    // No forced mass invalidation on a refresh button click.
}

export async function clearFriendCache(login) {
    if (login) {
        await storage.remove([legacyKey(login), resourceKey(login, "profile"),
            resourceKey(login, "logtime")]);
        return;
    }
    const all = await storage.get(null);
    const keys = Object.keys(all).filter(key =>
        key.startsWith(CACHE_KEY_PREFIX) || key.startsWith("tf_resource_"));
    if (keys.length) await storage.remove(keys);
}
