/**
 * @file friends-list.js
 * @description Renders the complete friends list with loading states and sections.
 *
 * Handles:
 * - Loading state while fetching
 * - Empty state when no friends
 * - Error state with retry
 * - Pinned and regular friend sections
 */

import { CSS_CLASSES } from "../constants.js";
import { getTodayDateString } from "../utils.js";
import { getFriendList, saveFriendList, cleanupPinnedFriends } from "../storage.js";
import { fetchFriendData } from "../api.js";
import { sortFriendDataList } from "../sorting.js";
import { createFriendItem } from "./friend-item.js";

/**
 * Renders the friends list in the specified container.
 *
 * @param {HTMLElement} container - Container element for the list
 * @param {string} sortPreference - Current sort preference
 * @param {Function} onRefresh - Callback to refresh the entire overlay
 */
export async function renderFriendsList(container, sortPreference, onRefresh) {
    const today = getTodayDateString();
    let friendList = await getFriendList();

    container.innerHTML = "";

    // Show loading state
    showLoadingState(container);

    // Handle empty list
    if (!friendList.length) {
        showEmptyState(container);
        return;
    }

    try {
        // Fetch all friend data in parallel
        const friendPromises = friendList.map(friend => fetchFriendData(friend));
        const results = await Promise.all(friendPromises);
        const friendDataList = results.filter(data => data !== null);

        // Remove friends that no longer exist from the list
        if (friendDataList.length !== friendList.length) {
            const validFriends = friendDataList.map(data => data.friend);
            await saveFriendList(validFriends);
            friendList = validFriends;
        }

        // Get and clean pinned list
        const pinnedList = await cleanupPinnedFriends(friendList);

        // Split into pinned and regular friends
        const pinnedFriends = friendDataList.filter(data => pinnedList.includes(data.friend));
        const regularFriends = friendDataList.filter(data => !pinnedList.includes(data.friend));

        // Sort both lists
        sortFriendDataList(pinnedFriends, sortPreference);
        sortFriendDataList(regularFriends, sortPreference);

        // Clear loading and render
        container.innerHTML = "";

        const list = document.createElement("div");
        list.className = "tf-friends-list-scroll";
        container.appendChild(list);

        // Render pinned section
        if (pinnedFriends.length) {
            list.appendChild(createSectionTitle("Pinned"));

            for (const data of pinnedFriends) {
                createFriendItem({
                    container: list,
                    friend: data.friend,
                    today,
                    friendObject: data.friend_object,
                    logTimeObject: data.log_time_object,
                    isPinned: true,
                    onRefresh
                });
            }
        }

        // Render regular friends section
        if (regularFriends.length) {
            list.appendChild(createSectionTitle("Friends"));

            for (const data of regularFriends) {
                createFriendItem({
                    container: list,
                    friend: data.friend,
                    today,
                    friendObject: data.friend_object,
                    logTimeObject: data.log_time_object,
                    isPinned: false,
                    onRefresh
                });
            }
        }

    } catch (error) {
        showErrorState(container, sortPreference, onRefresh);
    }
}

/**
 * Creates a section title element.
 */
function createSectionTitle(title) {
    const sectionTitle = document.createElement("div");
    sectionTitle.className = CSS_CLASSES.sectionTitle;
    sectionTitle.textContent = title;
    return sectionTitle;
}

/**
 * Shows the loading spinner.
 */
function showLoadingState(container) {
    container.innerHTML = `
        <div class="tf-loading">
            <div class="tf-loading__text">Loading friends...</div>
            <div class="tf-loading__spinner"></div>
        </div>
    `;
}

/**
 * Shows the empty state when no friends exist.
 */
function showEmptyState(container) {
    container.innerHTML = `
        <div class="tf-empty">
            <div class="tf-empty__box">
                Add friends to show them here
            </div>
        </div>
    `;
}

/**
 * Shows error state with retry button.
 */
function showErrorState(container, sortPreference, onRefresh) {
    container.innerHTML = `
        <div class="tf-error">
            <div class="tf-error__title">Failed to load friends</div>
            <div class="tf-error__message">There was an error loading your friend list</div>
            <button type="button" class="tf-error__retry">Retry</button>
        </div>
    `;

    const retryButton = container.querySelector(".tf-error__retry");
    if (retryButton) {
        retryButton.onclick = () => renderFriendsList(container, sortPreference, onRefresh);
    }
}
