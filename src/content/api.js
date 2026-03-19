/**
 * @file api.js
 * @description Network requests for fetching friend and profile data from 42 intra APIs.
 *
 * Uses the cache module to avoid redundant network requests.
 * Implements retry logic for transient failures.
 */

import { getCachedFriendData, setCachedFriendData } from "./cache.js";

/**
 * Fetches complete friend data (profile + log time) with caching and retry.
 *
 * @param {string} friend - Friend login to fetch
 * @param {number} [retries=2] - Number of retry attempts on failure
 * @returns {Promise<Object|null>} Friend data object or null if user doesn't exist
 * @throws {Error} If all retry attempts fail
 */
export async function fetchFriendData(friend, retries = 2) {
    // Check cache first
    const cached = await getCachedFriendData(friend);
    if (cached) {
        return cached;
    }

    // Fetch with retry logic
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const friendObject = await fetchUserProfile(friend);

            // Empty response means user doesn't exist
            if (!friendObject || !Object.keys(friendObject).length) {
                return null;
            }

            const logTimeObject = await fetchUserLogTime(friend);

            const data = {
                friend,
                friend_object: friendObject,
                log_time_object: logTimeObject
            };

            // Cache the successful result
            await setCachedFriendData(friend, data);
            return data;

        } catch (error) {
            if (attempt === retries) {
                console.warn(`Failed to load data for ${friend} after ${retries + 1} attempts`, error);
                throw error;
            }

            // Exponential backoff: 1s, 2s, 3s...
            await sleep(1000 * (attempt + 1));
        }
    }

    return null;
}

/**
 * Fetches user profile data from the intra API.
 * @param {string} login - User login
 * @returns {Promise<Object>} User profile object
 */
async function fetchUserProfile(login) {
    const response = await fetch(`https://profile.intra.42.fr/users/${login}`, {
        credentials: "include"
    });
    return response.json();
}

/**
 * Fetches user log time statistics from the intra API.
 * @param {string} login - User login
 * @returns {Promise<Object>} Log time data keyed by date
 */
async function fetchUserLogTime(login) {
    const response = await fetch(`https://translate.intra.42.fr/users/${login}/locations_stats.json`, {
        credentials: "include"
    });
    return response.json();
}

/**
 * Utility function to pause execution.
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
