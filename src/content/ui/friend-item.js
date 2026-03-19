/**
 * @file friend-item.js
 * @description Renders a single friend row/card in the friends list.
 *
 * Each friend item displays:
 * - Profile photo with hover card
 * - Login and daily log time
 * - Cluster location (clickable if online)
 * - Online/offline status indicator
 * - Pin/unpin button
 * - Delete button
 */

import { CSS_CLASSES } from "../constants.js";
import { formatLogTime } from "../utils.js";
import { getFriendList, saveFriendList, getPinnedFriendList, savePinnedFriendList } from "../storage.js";
import { addTooltipOnHover } from "./tooltip.js";
import { addProfileHoverCard } from "./hover-card.js";

/**
 * Creates and appends a friend item element to the container.
 *
 * @param {Object} options - Friend item options
 * @param {HTMLElement} options.container - Parent element to append to
 * @param {string} options.friend - Friend login
 * @param {string} options.today - Today's date in YYYY-MM-DD format
 * @param {Object} options.friendObject - Friend profile data
 * @param {Object} options.logTimeObject - Friend log time data
 * @param {boolean} options.isPinned - Whether friend is pinned
 * @param {Function} options.onRefresh - Callback to refresh the list after changes
 */
export function createFriendItem({
    container,
    friend,
    today,
    friendObject,
    logTimeObject,
    isPinned,
    onRefresh
}) {
    try {
        const item = document.createElement("div");
        item.className = isPinned
            ? `${CSS_CLASSES.friendItem} ${CSS_CLASSES.friendItemPinned}`
            : CSS_CLASSES.friendItem;

        // Make the whole row clickable
        item.addEventListener("click", () => {
            window.open(`https://profile.intra.42.fr/users/${friend}`, "_blank");
        });

        // Profile photo
        const photo = createProfilePhoto(friend, friendObject);
        item.appendChild(photo);

        // Details (login + log time)
        const details = createDetailsSection(friend, today, logTimeObject, isPinned);
        item.appendChild(details);

        // Action area (cluster, status, buttons)
        const actions = createActionsSection(friend, friendObject, isPinned, item, onRefresh);
        item.appendChild(actions);

        container.appendChild(item);
    } catch (error) {
        console.warn(`Failed to display data for ${friend}`, error);
    }
}

/**
 * Creates the profile photo element with hover card.
 */
function createProfilePhoto(friend, friendObject) {
    const photo = document.createElement("div");
    photo.className = "tf-friend-photo";

    if (friendObject.image?.link) {
        photo.style.backgroundImage = `url(${friendObject.image.link})`;
    }

    // Attach hover card for detailed view
    addProfileHoverCard(photo, friend, friendObject);

    // Photo click opens profile (stop propagation to not trigger row click twice)
    photo.addEventListener("click", (event) => {
        event.stopPropagation();
        window.open(`https://profile.intra.42.fr/users/${friend}`, "_blank");
    });

    return photo;
}

/**
 * Creates the details section with login and log time.
 */
function createDetailsSection(friend, today, logTimeObject, isPinned) {
    const details = document.createElement("div");
    details.className = "tf-friend-details";

    const login = document.createElement("div");
    login.className = "tf-friend-login";

    const loginText = document.createElement("span");
    loginText.textContent = friend;
    login.appendChild(loginText);

    if (isPinned) {
        const pinnedBadge = document.createElement("span");
        pinnedBadge.className = "tf-pinned-badge";
        pinnedBadge.textContent = "📌";
        login.appendChild(pinnedBadge);
    }

    const logTime = document.createElement("div");
    logTime.className = "tf-friend-logtime";
    logTime.textContent = formatLogTime(logTimeObject[today]);

    details.appendChild(login);
    details.appendChild(logTime);

    return details;
}

/**
 * Creates the actions section with cluster location, status indicator, and buttons.
 */
function createActionsSection(friend, friendObject, isPinned, itemElement, onRefresh) {
    const actions = document.createElement("div");
    actions.className = "tf-friend-actions";

    // Cluster position
    const clusterPosition = document.createElement("div");
    clusterPosition.className = "tf-friend-cluster";

    if (friendObject.location) {
        clusterPosition.textContent = friendObject.location;
        clusterPosition.classList.add("tf-friend-cluster--online");
        clusterPosition.onclick = (event) => {
            event.stopPropagation();
            window.open(`https://meta.intra.42.fr/clusters#${friendObject.location}`, "_blank");
        };
        addTooltipOnHover(clusterPosition, "Open cluster map");
    } else {
        clusterPosition.textContent = "Offline";
    }

    // Status indicator
    const status = document.createElement("div");
    status.className = friendObject.location
        ? `tf-friend-status ${CSS_CLASSES.statusOnline}`
        : `tf-friend-status ${CSS_CLASSES.statusOffline}`;

    // Pin button
    const pinButton = createPinButton(friend, isPinned, onRefresh);

    // Delete button
    const deleteButton = createDeleteButton(friend, itemElement, onRefresh);

    actions.appendChild(clusterPosition);
    actions.appendChild(status);
    actions.appendChild(pinButton);
    actions.appendChild(deleteButton);

    return actions;
}

/**
 * Creates the pin/unpin button.
 */
function createPinButton(friend, isPinned, onRefresh) {
    const pinButton = document.createElement("button");
    pinButton.type = "button";
    pinButton.className = isPinned ? "tf-btn-pin tf-btn-pin--active" : "tf-btn-pin";
    pinButton.textContent = "📌";

    addTooltipOnHover(pinButton, isPinned ? "Unpin friend" : "Pin friend");

    pinButton.onclick = async (event) => {
        event.stopPropagation();

        const pinnedList = await getPinnedFriendList();
        const alreadyPinned = pinnedList.includes(friend);

        const updatedPinnedList = alreadyPinned
            ? pinnedList.filter(value => value !== friend)
            : [...pinnedList, friend];

        await savePinnedFriendList(updatedPinnedList);
        await onRefresh();
    };

    return pinButton;
}

/**
 * Creates the delete button.
 */
function createDeleteButton(friend, itemElement, onRefresh) {
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "tf-btn-delete";
    deleteButton.textContent = "✕";

    addTooltipOnHover(deleteButton, "Delete friend");

    deleteButton.onclick = async (event) => {
        event.stopPropagation();

        if (!confirm(`Delete ${friend} from your friend list?`)) {
            return;
        }

        const currentList = await getFriendList();
        const updatedList = currentList.filter(value => value !== friend);
        await saveFriendList(updatedList);

        // Also remove from pinned if present
        const pinnedList = await getPinnedFriendList();
        const updatedPinnedList = pinnedList.filter(value => value !== friend);
        await savePinnedFriendList(updatedPinnedList);

        itemElement.remove();
        await onRefresh();
    };

    return deleteButton;
}
