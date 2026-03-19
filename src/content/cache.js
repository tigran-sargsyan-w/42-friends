/**
 * @file cache.js
 * @description Local cache for friend data to reduce API calls.
 *
 * Uses chrome.storage.local (not synced) because:
 * - Cache data can be large
 * - Cache is device-specific and transient
 * - Reduces unnecessary network requests
 */

import { CACHE_EXPIRY_MS, CACHE_KEY_PREFIX } from "./constants.js";

const localStorage = chrome.storage.local;

/**
 * Generates the cache key for a friend login.
 * @param {string} friend - Friend login
 * @returns {string} Cache key
 */
function getCacheKey(friend) {
    return `${CACHE_KEY_PREFIX}${friend}`;
}

/**
 * Gets cached friend data if it exists and hasn't expired.
 * @param {string} friend - Friend login
 * @returns {Promise<Object|null>} Cached data or null if expired/missing
 */
export async function getCachedFriendData(friend) {
    const cacheKey = getCacheKey(friend);
    const result = await localStorage.get(cacheKey);
    const cached = result[cacheKey];

    if (!cached) {
        return null;
    }

    // Check if cache is still valid
    if (Date.now() - cached.timestamp < CACHE_EXPIRY_MS) {
        return cached.data;
    }

    // Cache expired, remove it
    await localStorage.remove(cacheKey);
    return null;
}

/**
 * Stores friend data in cache with current timestamp.
 * @param {string} friend - Friend login
 * @param {Object} data - Friend data to cache
 */
export async function setCachedFriendData(friend, data) {
    const cacheKey = getCacheKey(friend);
    await localStorage.set({
        [cacheKey]: {
            data,
            timestamp: Date.now()
        }
    });
}

/**
 * Clears cached data for a specific friend or all friends.
 * @param {string} [friend] - Optional friend login. If omitted, clears all cache.
 */
export async function clearFriendCache(friend) {
    if (friend) {
        await localStorage.remove(getCacheKey(friend));
        return;
    }

    // Clear all friend cache entries
    const all = await localStorage.get(null);
    const cacheKeys = Object.keys(all).filter(key => key.startsWith(CACHE_KEY_PREFIX));

    if (cacheKeys.length > 0) {
        await localStorage.remove(cacheKeys);
    }
}
