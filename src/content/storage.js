/**
 * @file storage.js
 * @description Storage operations for friend list, pinned friends, and preferences.
 *
 * Handles:
 * - Schema migration between versions
 * - Friend list CRUD operations
 * - Pinned friends CRUD operations
 * - Overlay state persistence
 *
 * Uses chrome.storage.sync for cross-device synchronization.
 */

import { STORAGE_SCHEMA_VERSION, SYNC_KEYS, SORT_OPTIONS, DEFAULT_SORT } from "./constants.js";
import { normalizeFriendList } from "./utils.js";

const syncStorage = chrome.storage.sync;

/**
 * Migrates storage schema to the current version if needed.
 * Handles incremental migrations from any previous version.
 */
export async function migrateStorageIfNeeded() {
    const syncResult = await syncStorage.get(null);
    const currentVersion = Number(syncResult[SYNC_KEYS.schemaVersion] || 0);

    if (currentVersion >= STORAGE_SCHEMA_VERSION) {
        return;
    }

    const updates = {};

    // Migration to v1: normalize friend list, validate sort, fix collapsed/width
    if (currentVersion < 1) {
        const migratedFriendList = normalizeFriendList(syncResult[SYNC_KEYS.friendList]);
        updates[SYNC_KEYS.friendList] = migratedFriendList;

        const currentSort = syncResult[SYNC_KEYS.friendSort];
        updates[SYNC_KEYS.friendSort] = SORT_OPTIONS.includes(currentSort)
            ? currentSort
            : DEFAULT_SORT;

        const collapsedValue = syncResult[SYNC_KEYS.overlayCollapsed];
        updates[SYNC_KEYS.overlayCollapsed] = collapsedValue === "true" ? "true" : "false";

        const widthValue = syncResult[SYNC_KEYS.overlayWidth];
        const parsedWidth = Number(widthValue);
        updates[SYNC_KEYS.overlayWidth] = Number.isFinite(parsedWidth) && parsedWidth >= 320
            ? String(parsedWidth)
            : "360";
    }

    // Migration to v2: clean up pinned friends to only include valid friends
    if (currentVersion < 2) {
        const friendList = normalizeFriendList(
            updates[SYNC_KEYS.friendList] !== undefined
                ? updates[SYNC_KEYS.friendList]
                : syncResult[SYNC_KEYS.friendList]
        );

        const currentPinned = normalizeFriendList(syncResult[SYNC_KEYS.pinnedFriends]);
        updates[SYNC_KEYS.pinnedFriends] = currentPinned.filter(friend => friendList.includes(friend));
    }

    updates[SYNC_KEYS.schemaVersion] = STORAGE_SCHEMA_VERSION;
    await syncStorage.set(updates);
}

// ============================================================================
// Friend List Operations
// ============================================================================

/**
 * Gets the current friend list from storage.
 * @returns {Promise<string[]>} Normalized friend login list
 */
export async function getFriendList() {
    const result = await syncStorage.get(SYNC_KEYS.friendList);
    return normalizeFriendList(result[SYNC_KEYS.friendList]);
}

/**
 * Saves the friend list to storage.
 * @param {string[]} list - Friend logins to save
 */
export async function saveFriendList(list) {
    const normalizedList = normalizeFriendList(list);
    await syncStorage.set({ [SYNC_KEYS.friendList]: normalizedList });
}

// ============================================================================
// Pinned Friends Operations
// ============================================================================

/**
 * Gets the current pinned friends list from storage.
 * @returns {Promise<string[]>} Normalized pinned friend login list
 */
export async function getPinnedFriendList() {
    const result = await syncStorage.get(SYNC_KEYS.pinnedFriends);
    return normalizeFriendList(result[SYNC_KEYS.pinnedFriends]);
}

/**
 * Saves the pinned friends list to storage.
 * @param {string[]} list - Pinned friend logins to save
 */
export async function savePinnedFriendList(list) {
    const normalizedList = normalizeFriendList(list);
    await syncStorage.set({ [SYNC_KEYS.pinnedFriends]: normalizedList });
}

/**
 * Removes pinned friends that are no longer in the friend list.
 * @param {string[]} friendList - Current friend list to validate against
 * @returns {Promise<string[]>} Cleaned pinned list
 */
export async function cleanupPinnedFriends(friendList) {
    const pinnedList = await getPinnedFriendList();
    const cleanedPinnedList = pinnedList.filter(friend => friendList.includes(friend));

    if (cleanedPinnedList.length !== pinnedList.length) {
        await savePinnedFriendList(cleanedPinnedList);
    }

    return cleanedPinnedList;
}

// ============================================================================
// Sort Preference Operations
// ============================================================================

/**
 * Gets the current friend sort preference.
 * @returns {Promise<string>} Sort preference string
 */
export async function getFriendSortPreference() {
    const result = await syncStorage.get(SYNC_KEYS.friendSort);
    return result[SYNC_KEYS.friendSort] || DEFAULT_SORT;
}

/**
 * Saves the friend sort preference.
 * @param {string} sortValue - Sort option to save
 */
export async function saveFriendSortPreference(sortValue) {
    await syncStorage.set({ [SYNC_KEYS.friendSort]: sortValue });
}

// ============================================================================
// Overlay State Operations
// ============================================================================

/**
 * Gets a specific overlay state value from storage.
 * @param {string} key - Storage key
 * @param {*} fallback - Default value if key doesn't exist
 * @returns {Promise<*>} Stored value or fallback
 */
export async function getOverlayState(key, fallback) {
    const result = await syncStorage.get(key);
    return result[key] !== undefined ? result[key] : fallback;
}

/**
 * Sets an overlay state value in storage.
 * @param {string} key - Storage key
 * @param {*} value - Value to store
 */
export async function setOverlayState(key, value) {
    await syncStorage.set({ [key]: value });
}
