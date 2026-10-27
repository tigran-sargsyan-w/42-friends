/**
 * Cache format and storage keys remain compatible with v0.1.5.
 * Expired records are retained for immediate, visibly stale display.
 */
import { CACHE_EXPIRY_MS, CACHE_KEY_PREFIX } from "./constants.js";

const storage = chrome.storage.local;

function key(friend) {
    return `${CACHE_KEY_PREFIX}${friend}`;
}

export async function getCachedFriendData(friend, { allowStale = false } = {}) {
    const result = await storage.get(key(friend));
    const record = result[key(friend)];
    if (!record || !record.data) return null;
    if (allowStale || Date.now() - record.timestamp < CACHE_EXPIRY_MS) {
        return record.data;
    }
    return null;
}

export async function isFriendCacheFresh(friend) {
    const result = await storage.get(key(friend));
    const record = result[key(friend)];
    return Boolean(record && record.data &&
        Date.now() - record.timestamp < CACHE_EXPIRY_MS);
}

export async function setCachedFriendData(friend, data) {
    await storage.set({ [key(friend)]: { data, timestamp: Date.now() } });
}

/** Refresh without deleting known photos, locations, or logtimes. */
export async function markFriendCacheForRefresh(minAgeMs = 60000) {
    const data = await storage.get(null);
    const now = Date.now();
    const modified = {};
    for (const [entryKey, record] of Object.entries(data)) {
        if (!entryKey.startsWith(CACHE_KEY_PREFIX) || !record?.data ||
            !Number.isFinite(record.timestamp)) continue;
        if (now - record.timestamp < minAgeMs) continue;
        modified[entryKey] = { ...record, timestamp: 0 };
    }
    if (Object.keys(modified).length) await storage.set(modified);
}

export async function clearFriendCache(friend) {
    if (friend) {
        await storage.remove(key(friend));
        return;
    }
    const all = await storage.get(null);
    const keys = Object.keys(all).filter(k => k.startsWith(CACHE_KEY_PREFIX));
    if (keys.length) await storage.remove(keys);
}
