/**
 * Per-resource cache. Old friend_cache_* entries are read for backward
 * compatibility with 0.1.5; users' saved friend lists are never migrated away.
 */
const store = chrome.storage.local;
const PREFIX = "tf_resource_v2_";
const LEGACY_PREFIX = "friend_cache_";
const TTL = {
    profile: 3 * 60 * 1000, // location is part of the profile response
    logtime: 10 * 60 * 1000
};

function resourceKey(friend, kind) {
    return `${PREFIX}${kind}_${friend}`;
}

export async function readFriendCache(friend) {
    const profileKey = resourceKey(friend, "profile");
    const logtimeKey = resourceKey(friend, "logtime");
    const legacyKey = LEGACY_PREFIX + friend;
    const result = await store.get([profileKey, logtimeKey, legacyKey]);
    const legacy = result[legacyKey];

    function fromCache(kind, legacyField) {
        const entry = result[resourceKey(friend, kind)] ||
            (legacy?.data?.[legacyField] && {
                data: legacy.data[legacyField],
                timestamp: legacy.timestamp
            });
        if (!entry || typeof entry.timestamp !== "number" || !entry.data ||
            typeof entry.data !== "object") return null;
        return {
            data: entry.data,
            timestamp: entry.timestamp,
            fresh: Date.now() - entry.timestamp < TTL[kind]
        };
    }

    return {
        profile: fromCache("profile", "friend_object"),
        logtime: fromCache("logtime", "log_time_object")
    };
}

export async function saveFriendResource(friend, kind, data) {
    if (!Object.hasOwn(TTL, kind)) throw new Error("Unsupported cache resource");
    await store.set({
        [resourceKey(friend, kind)]: { data, timestamp: Date.now() }
    });
}

export async function clearFriendCache(friend) {
    if (friend) {
        await store.remove([
            resourceKey(friend, "profile"),
            resourceKey(friend, "logtime"),
            LEGACY_PREFIX + friend
        ]);
        return;
    }
    const values = await store.get(null);
    const keys = Object.keys(values).filter(
        key => key.startsWith(PREFIX) || key.startsWith(LEGACY_PREFIX)
    );
    if (keys.length) await store.remove(keys);
}

/**
 * Manual refresh: retain the data, but expire entries older than a minimum age.
 * This prevents the refresh button from erasing the list or bypassing cooldowns.
 */
export async function requestFriendRefresh() {
    const values = await store.get(null);
    const updates = {};
    for (const [key, entry] of Object.entries(values)) {
        if (!key.startsWith(PREFIX) || !entry || typeof entry.timestamp !== "number") continue;
        const minAge = key.startsWith(PREFIX + "profile_") ? 30000 : 180000;
        if (Date.now() - entry.timestamp >= minAge && entry.timestamp !== 0) {
            updates[key] = { ...entry, timestamp: 0 };
        }
    }
    if (Object.keys(updates).length) await store.set(updates);
}
