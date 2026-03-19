/**
 * @file profile-button.js
 * @description Add/Remove friend button on profile pages.
 *
 * Handles:
 * - Detecting when we're on a user profile page
 * - Creating and updating the friend button
 * - MutationObserver for SPA navigation
 * - URL change detection for client-side routing
 */

import { DOM_IDS, CSS_CLASSES } from "../constants.js";
import { normalizeFriendLogin } from "../utils.js";
import { getFriendList, saveFriendList, getPinnedFriendList, savePinnedFriendList } from "../storage.js";
import { clearFriendCache } from "../cache.js";
import { renderFriendsOverlay } from "./overlay.js";

// Module state
let profileObserverInitialized = false;
let profileButtonUpdateInProgress = false;
let profileUrlWatcher = null;

/**
 * Gets the login context from the current profile page.
 * Returns null if not on a valid profile page.
 *
 * @returns {{ login: string, loginElement: HTMLElement } | null}
 */
function getProfileLoginContext() {
    if (window.location.hostname !== "profile.intra.42.fr") {
        return null;
    }

    const pathMatch = window.location.pathname.match(/^\/users\/([^/?#]+)/);
    if (!pathMatch) {
        return null;
    }

    const loginElement = document.querySelector("span.login[data-login]");
    if (!loginElement) {
        return null;
    }

    const loginFromData = (loginElement.getAttribute("data-login") || "").trim();
    const loginFromPath = decodeURIComponent(pathMatch[1] || "").trim();
    const login = normalizeFriendLogin(loginFromData || loginFromPath);

    if (!login) {
        return null;
    }

    return { login, loginElement };
}

/**
 * Refreshes the overlay if it's present on the page.
 */
async function refreshOverlayIfPresent() {
    const overlayBody = document.querySelector(`.${CSS_CLASSES.friendsBody}`);
    if (!overlayBody) {
        return;
    }

    await renderFriendsOverlay(overlayBody);
}

/**
 * Renders or updates the friend button on profile pages.
 */
async function renderProfileFriendButton() {
    const context = getProfileLoginContext();
    const existingButton = document.getElementById(DOM_IDS.profileFriendButton);

    // If not on a profile page, remove button if present
    if (!context) {
        if (existingButton) {
            existingButton.remove();
        }
        return;
    }

    const { login, loginElement } = context;
    let button = existingButton;

    // Create button if it doesn't exist
    if (!button) {
        button = document.createElement("button");
        button.id = DOM_IDS.profileFriendButton;
        button.type = "button";
    }

    // Ensure button is in the right position
    if (loginElement.nextElementSibling !== button) {
        loginElement.insertAdjacentElement("afterend", button);
    }

    button.dataset.login = login;

    // Update button state based on friend list
    const friendList = await getFriendList();
    const isFriend = friendList.includes(login);

    button.dataset.mode = isFriend ? "remove" : "add";
    button.textContent = isFriend ? "Remove Friend" : "Add Friend";

    // Handle button click
    button.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const targetLogin = normalizeFriendLogin(button.dataset.login);
        if (!targetLogin) {
            return;
        }

        const currentList = await getFriendList();
        const alreadyFriend = currentList.includes(targetLogin);

        if (alreadyFriend) {
            // Remove friend
            const nextList = currentList.filter(value => value !== targetLogin);
            await saveFriendList(nextList);
            await clearFriendCache(targetLogin);

            // Also remove from pinned
            const pinnedList = await getPinnedFriendList();
            const nextPinnedList = pinnedList.filter(value => value !== targetLogin);
            await savePinnedFriendList(nextPinnedList);
        } else {
            // Add friend
            const nextList = [...currentList, targetLogin];
            await saveFriendList(nextList);
        }

        await renderProfileFriendButton();
        await refreshOverlayIfPresent();
    };
}

/**
 * Updates the profile friend button with debouncing.
 */
async function updateProfileFriendButton() {
    if (profileButtonUpdateInProgress) {
        return;
    }

    profileButtonUpdateInProgress = true;
    try {
        await renderProfileFriendButton();
    } finally {
        profileButtonUpdateInProgress = false;
    }
}

/**
 * Initializes the profile friend button functionality.
 * Sets up MutationObserver and URL change detection.
 */
export function initProfileFriendButton() {
    if (profileObserverInitialized) {
        return;
    }

    profileObserverInitialized = true;

    // Watch for DOM changes (SPA navigation)
    const observer = new MutationObserver(() => {
        updateProfileFriendButton();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // Poll for URL changes (client-side routing)
    let previousUrl = window.location.href;
    profileUrlWatcher = window.setInterval(() => {
        const currentUrl = window.location.href;
        if (currentUrl !== previousUrl) {
            previousUrl = currentUrl;
            updateProfileFriendButton();
        }
    }, 500);

    // Listen for navigation events
    window.addEventListener("popstate", updateProfileFriendButton);
    window.addEventListener("hashchange", updateProfileFriendButton);

    // Initial render
    updateProfileFriendButton();
}
