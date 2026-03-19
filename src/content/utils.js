/**
 * @file utils.js
 * @description Small utility functions for data normalization and extraction.
 *
 * These functions are pure and have no side effects, making them easy to test
 * and reuse across different modules.
 */

/**
 * Normalizes a friend login to lowercase trimmed string.
 * @param {*} value - Raw login value
 * @returns {string} Normalized login
 */
export function normalizeFriendLogin(value) {
    return String(value || "").trim().toLowerCase();
}

/**
 * Normalizes a list of friends, removing duplicates and empty values.
 * @param {*} list - Raw friend list
 * @returns {string[]} Normalized unique friend logins
 */
export function normalizeFriendList(list) {
    if (!Array.isArray(list)) {
        return [];
    }

    const normalized = list
        .map(normalizeFriendLogin)
        .filter(Boolean);

    return [...new Set(normalized)];
}

/**
 * Extracts the main 42cursus level from a friend object.
 * Returns "—" if no valid level is found.
 *
 * @param {Object} friendObject - API response with cursus data
 * @returns {{ cursusLevel: string }} Object containing the formatted level
 */
export function getMainCursusInfo(friendObject) {
    const cursusList = Array.isArray(friendObject?.cursus)
        ? friendObject.cursus
        : [];

    if (!cursusList.length) {
        return { cursusLevel: "—" };
    }

    const mainCursus = cursusList.find(item =>
        item &&
        typeof item === "object" &&
        item["42cursus"]
    );

    if (!mainCursus) {
        return { cursusLevel: "—" };
    }

    const rawLevel = mainCursus["42cursus"]?.level;
    const parsedLevel = Number(rawLevel);

    return {
        cursusLevel: Number.isFinite(parsedLevel)
            ? parsedLevel.toFixed(2)
            : "—"
    };
}

/**
 * Returns today's date in YYYY-MM-DD format.
 * @returns {string} ISO date string for today
 */
export function getTodayDateString() {
    return new Date().toISOString().split("T")[0];
}

/**
 * Formats log time string to display format.
 * @param {string|undefined} timeString - Time in "HH:MM" format
 * @returns {string} Formatted time like "5h30 today" or "0h00 today"
 */
export function formatLogTime(timeString) {
    if (!timeString) {
        return "0h00 today";
    }

    const [hours, minutes] = timeString.split(":");
    return `${hours}h${minutes || "00"} today`;
}
