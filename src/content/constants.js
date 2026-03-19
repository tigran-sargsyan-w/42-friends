/**
 * @file constants.js
 * @description Shared constants for storage keys, DOM IDs, and sort options.
 *
 * Centralizing these values prevents magic strings scattered throughout the codebase
 * and makes it easy to change keys in one place.
 */

export const STORAGE_SCHEMA_VERSION = 2;

/**
 * Keys used for chrome.storage.sync
 */
export const SYNC_KEYS = {
    schemaVersion: "schema_version",
    friendList: "friend_list",
    pinnedFriends: "pinned_friends",
    friendSort: "friend_sort",
    overlayCollapsed: "tf_overlay_collapsed",
    overlayWidth: "tf_overlay_width"
};

/**
 * DOM element IDs used by the extension
 */
export const DOM_IDS = {
    overlay: "tf-friends-overlay",
    styles: "tf-friends-styles",
    profileFriendButton: "tf-profile-friend-btn"
};

/**
 * CSS class names used by the extension
 */
export const CSS_CLASSES = {
    friendsBody: "tf-friends-body",
    friendItem: "tf-friend-item",
    friendItemPinned: "tf-friend-item--pinned",
    sectionTitle: "tf-section-title",
    tooltip: "tf-tooltip",
    hoverCard: "tf-hover-card",
    statusOnline: "tf-status--online",
    statusOffline: "tf-status--offline"
};

/**
 * Available sort options
 */
export const SORT_OPTIONS = [
    "Alphabetical (A-Z)",
    "Alphabetical (Z-A)",
    "Online First",
    "Offline First"
];

export const DEFAULT_SORT = "Alphabetical (A-Z)";

/**
 * Cache settings
 */
export const CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
export const CACHE_KEY_PREFIX = "friend_cache_";

/**
 * UI defaults
 */
export const OVERLAY_DEFAULTS = {
    width: 360,
    minWidth: 320,
    maxWidth: 420,
    right: 24,
    bottom: 24
};
