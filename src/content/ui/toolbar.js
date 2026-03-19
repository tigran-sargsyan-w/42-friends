/**
 * @file toolbar.js
 * @description Toolbar component with friend add input and sort dropdown.
 */

import { SORT_OPTIONS } from "../constants.js";
import { normalizeFriendLogin } from "../utils.js";
import { getFriendList, saveFriendList, getFriendSortPreference, saveFriendSortPreference } from "../storage.js";
import { renderFriendsList } from "./friends-list.js";

/**
 * Creates and renders the toolbar into the container.
 *
 * @param {HTMLElement} toolbarContainer - Container for the toolbar
 * @param {HTMLElement} listContainer - Container for the friends list (for refresh)
 * @param {Function} onRefresh - Callback to refresh the entire overlay
 */
export async function createFriendsToolbar(toolbarContainer, listContainer, onRefresh) {
    const sortPreference = await getFriendSortPreference();

    const wrapper = document.createElement("div");
    wrapper.className = "tf-toolbar";

    // Top row: input + add button
    const topRow = document.createElement("div");
    topRow.className = "tf-toolbar__row";

    const input = document.createElement("input");
    input.type = "text";
    input.className = "tf-toolbar__input";
    input.placeholder = "Enter login";

    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.className = "tf-toolbar__add-btn";
    addButton.textContent = "Add";

    /**
     * Handles adding a new friend.
     */
    async function addFriend() {
        const newFriend = normalizeFriendLogin(input.value);
        const friendList = await getFriendList();

        if (!newFriend) {
            return;
        }

        if (friendList.includes(newFriend)) {
            alert("Friend already in list!");
            return;
        }

        friendList.push(newFriend);
        await saveFriendList(friendList);
        input.value = "";

        const currentSort = await getFriendSortPreference();
        await renderFriendsList(listContainer, currentSort, onRefresh);
    }

    input.addEventListener("keydown", async (event) => {
        if (event.key === "Enter") {
            await addFriend();
        }
    });

    addButton.onclick = addFriend;

    topRow.appendChild(input);
    topRow.appendChild(addButton);

    // Bottom row: sort label + dropdown
    const bottomRow = document.createElement("div");
    bottomRow.className = "tf-toolbar__row tf-toolbar__row--sort";

    const sortLabel = document.createElement("div");
    sortLabel.className = "tf-toolbar__sort-label";
    sortLabel.textContent = "Sort:";

    const select = document.createElement("select");
    select.className = "tf-toolbar__select";

    for (const optionText of SORT_OPTIONS) {
        const option = document.createElement("option");
        option.value = optionText;
        option.textContent = optionText;
        option.selected = optionText === sortPreference;
        select.appendChild(option);
    }

    select.onchange = async () => {
        await saveFriendSortPreference(select.value);
        await renderFriendsList(listContainer, select.value, onRefresh);
    };

    bottomRow.appendChild(sortLabel);
    bottomRow.appendChild(select);

    wrapper.appendChild(topRow);
    wrapper.appendChild(bottomRow);
    toolbarContainer.appendChild(wrapper);
}
