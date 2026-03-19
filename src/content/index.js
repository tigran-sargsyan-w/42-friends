/**
 * @file index.js
 * @description Entry point for the 42 Friends content script.
 *
 * This bootstrap file is intentionally minimal. It:
 * 1. Guards against duplicate initialization
 * 2. Injects shared styles
 * 3. Runs storage migration
 * 4. Builds the overlay
 * 5. Initializes the profile friend button
 *
 * All business logic is delegated to specialized modules.
 */

import { DOM_IDS } from "./constants.js";
import { migrateStorageIfNeeded } from "./storage.js";
import { buildOverlay } from "./ui/overlay.js";
import { initProfileFriendButton } from "./ui/profile-button.js";
import styles from "./styles.css";

/**
 * Injects shared CSS styles into the document.
 * Guards against duplicate injection.
 */
function injectSharedStyles() {
    if (document.getElementById(DOM_IDS.styles)) {
        return;
    }

    const styleElement = document.createElement("style");
    styleElement.id = DOM_IDS.styles;
    styleElement.textContent = styles;
    document.head.appendChild(styleElement);
}

/**
 * Main initialization function.
 * Runs once when the content script loads.
 */
async function init() {
    // 1. Migrate storage schema if needed
    await migrateStorageIfNeeded();

    // 2. Inject shared styles
    injectSharedStyles();

    // 3. Build the main overlay
    await buildOverlay();

    // 4. Initialize profile page friend button
    initProfileFriendButton();
}

// Guard against duplicate initialization (e.g., if script runs multiple times)
if (!window.__42_FRIENDS_LOADED__) {
    window.__42_FRIENDS_LOADED__ = true;
    init();
}
