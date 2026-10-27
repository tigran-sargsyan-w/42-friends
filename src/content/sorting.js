/**
 * @file sorting.js
 * @description Sorting logic for friend data lists.
 *
 * Extracted into its own module because:
 * - Sorting logic is self-contained and testable
 * - Makes it easy to add new sort options in the future
 * - Keeps UI code cleaner by separating data manipulation
 */

/**
 * Sorts friend data list in place based on the selected preference.
 *
 * @param {Array<{friend: string, friend_object: Object}>} friendDataList - List to sort
 * @param {string} sortPreference - One of the SORT_OPTIONS values
 * @returns {Array} The same array, sorted in place
 */
export function sortFriendDataList(friendDataList, sortPreference) {
    switch (sortPreference) {
        case "Alphabetical (A-Z)":
            friendDataList.sort((a, b) => a.friend.localeCompare(b.friend));
            break;

        case "Alphabetical (Z-A)":
            friendDataList.sort((a, b) => b.friend.localeCompare(a.friend));
            break;

        case "Online First":
            friendDataList.sort((a, b) => {
                const onlineDelta = (b.friend_object.location ? 1 : 0) - (a.friend_object.location ? 1 : 0);
                if (onlineDelta !== 0) {
                    return onlineDelta;
                }
                return a.friend.localeCompare(b.friend);
            });
            break;

        case "Offline First":
            friendDataList.sort((a, b) => {
                const offlineDelta = (a.friend_object.location ? 1 : 0) - (b.friend_object.location ? 1 : 0);
                if (offlineDelta !== 0) {
                    return offlineDelta;
                }
                return a.friend.localeCompare(b.friend);
            });
            break;

        default:
            // Fallback to alphabetical
            friendDataList.sort((a, b) => a.friend.localeCompare(b.friend));
            break;
    }

    return friendDataList;
}
