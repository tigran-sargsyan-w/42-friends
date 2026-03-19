/**
 * @file overlay.js
 * @description Main overlay container with header, drag functionality, and body.
 *
 * This is the primary visible component - a floating panel that displays
 * the friends list and toolbar.
 */

import { DOM_IDS, SYNC_KEYS, CSS_CLASSES, OVERLAY_DEFAULTS } from "../constants.js";
import { getOverlayState, setOverlayState, getFriendSortPreference } from "../storage.js";
import { clearFriendCache } from "../cache.js";
import { createFriendsToolbar } from "./toolbar.js";
import { renderFriendsList } from "./friends-list.js";

/**
 * Builds and initializes the main overlay.
 * Returns existing overlay if already present.
 *
 * @returns {Promise<HTMLElement>} The overlay element
 */
export async function buildOverlay() {
    // Prevent duplicate overlays
    const existing = document.getElementById(DOM_IDS.overlay);
    if (existing) {
        return existing;
    }

    const collapsed = await getOverlayState(SYNC_KEYS.overlayCollapsed, "false") === "true";
    const savedWidth = await getOverlayState(SYNC_KEYS.overlayWidth, String(OVERLAY_DEFAULTS.width));

    const overlay = document.createElement("div");
    overlay.id = DOM_IDS.overlay;
    overlay.style.width = `${savedWidth}px`;

    // Header
    const { header, collapseIcon } = createHeader(collapsed);

    // Body
    const body = document.createElement("div");
    body.className = CSS_CLASSES.friendsBody;
    body.style.display = collapsed ? "none" : "block";

    // Refresh button handler
    const refreshButton = header.querySelector(".tf-header__refresh");
    refreshButton.onclick = async (event) => {
        event.stopPropagation();
        await clearFriendCache();
        await renderFriendsOverlay(body);
    };

    // Header click toggles collapse
    header.addEventListener("click", async () => {
        const isCollapsed = body.style.display === "none";
        body.style.display = isCollapsed ? "block" : "none";
        collapseIcon.textContent = isCollapsed ? "▾" : "▸";
        await setOverlayState(SYNC_KEYS.overlayCollapsed, isCollapsed ? "false" : "true");
    });

    overlay.appendChild(header);
    overlay.appendChild(body);
    document.body.appendChild(overlay);

    // Enable dragging
    makeOverlayDraggable(overlay, header);

    // Render content
    await renderFriendsOverlay(body);

    return overlay;
}

/**
 * Creates the overlay header with title, refresh button, and collapse icon.
 */
function createHeader(collapsed) {
    const header = document.createElement("div");
    header.className = "tf-header";

    const title = document.createElement("div");
    title.className = "tf-header__title";
    title.innerHTML = `<span class="tf-header__dot">●</span> Friends Tracker`;

    const actions = document.createElement("div");
    actions.className = "tf-header__actions";

    const refreshButton = document.createElement("button");
    refreshButton.type = "button";
    refreshButton.className = "tf-header__refresh";
    refreshButton.textContent = "↻";
    refreshButton.title = "Refresh friends";

    const collapseIcon = document.createElement("span");
    collapseIcon.className = "tf-header__collapse";
    collapseIcon.textContent = collapsed ? "▸" : "▾";

    actions.appendChild(refreshButton);
    actions.appendChild(collapseIcon);

    header.appendChild(title);
    header.appendChild(actions);

    return { header, collapseIcon };
}

/**
 * Renders the full overlay content (toolbar + friends list).
 *
 * @param {HTMLElement} body - The overlay body element
 */
export async function renderFriendsOverlay(body) {
    body.innerHTML = "";

    const toolbarContainer = document.createElement("div");
    const listContainer = document.createElement("div");

    body.appendChild(toolbarContainer);
    body.appendChild(listContainer);

    // Create refresh callback that re-renders the entire overlay
    const onRefresh = () => renderFriendsOverlay(body);

    await createFriendsToolbar(toolbarContainer, listContainer, onRefresh);

    const currentSort = await getFriendSortPreference();
    await renderFriendsList(listContainer, currentSort, onRefresh);
}

/**
 * Makes the overlay draggable by its header.
 *
 * @param {HTMLElement} overlay - The overlay element
 * @param {HTMLElement} dragHandle - The element used to initiate drag (header)
 */
function makeOverlayDraggable(overlay, dragHandle) {
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let startRight = OVERLAY_DEFAULTS.right;
    let startBottom = OVERLAY_DEFAULTS.bottom;

    dragHandle.addEventListener("mousedown", (event) => {
        // Don't start drag if clicking on buttons
        if (event.target.tagName === "BUTTON") {
            return;
        }

        isDragging = true;
        startX = event.clientX;
        startY = event.clientY;
        startRight = parseInt(window.getComputedStyle(overlay).right, 10) || OVERLAY_DEFAULTS.right;
        startBottom = parseInt(window.getComputedStyle(overlay).bottom, 10) || OVERLAY_DEFAULTS.bottom;
        document.body.style.userSelect = "none";
    });

    document.addEventListener("mousemove", (event) => {
        if (!isDragging) {
            return;
        }

        const deltaX = event.clientX - startX;
        const deltaY = event.clientY - startY;

        overlay.style.right = `${Math.max(8, startRight - deltaX)}px`;
        overlay.style.bottom = `${Math.max(8, startBottom - deltaY)}px`;
    });

    document.addEventListener("mouseup", () => {
        isDragging = false;
        document.body.style.userSelect = "";
    });
}
