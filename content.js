// 42 Friends - friends-only floating overlay

const syncStorage = chrome.storage.sync;
const localStorage = chrome.storage.local;

function addTooltipOnHover(element, title) {
    const tooltip = document.createElement("div");
    tooltip.textContent = title;
    tooltip.style.position = "absolute";
    tooltip.style.padding = "4px 8px";
    tooltip.style.backgroundColor = "rgba(0,0,0,.9)";
    tooltip.style.color = "white";
    tooltip.style.borderRadius = "6px";
    tooltip.style.fontSize = "12px";
    tooltip.style.pointerEvents = "none";
    tooltip.style.whiteSpace = "nowrap";
    tooltip.style.zIndex = "10001";
    tooltip.style.display = "none";
    document.body.appendChild(tooltip);

    const onMouseEnter = () => {
        tooltip.style.display = "block";
        const rect = element.getBoundingClientRect();
        tooltip.style.left = `${rect.left + window.scrollX}px`;
        tooltip.style.top = `${rect.top + window.scrollY - tooltip.offsetHeight - 6}px`;
    };

    const onMouseLeave = () => {
        tooltip.style.display = "none";
    };

    const onMouseMove = (e) => {
        tooltip.style.left = `${e.pageX + 10}px`;
        tooltip.style.top = `${e.pageY + 10}px`;
    };

    element.addEventListener("mouseenter", onMouseEnter);
    element.addEventListener("mouseleave", onMouseLeave);
    element.addEventListener("mousemove", onMouseMove);

    return tooltip;
}

async function getFriendList() {
    const result = await syncStorage.get("friend_list");
    return result.friend_list || [];
}

async function saveFriendList(list) {
    await syncStorage.set({ friend_list: list });
}

const CACHE_EXPIRY_MS = 5 * 60 * 1000;

async function getCachedFriendData(friend) {
    const cacheKey = `friend_cache_${friend}`;
    const result = await localStorage.get(cacheKey);
    const cached = result[cacheKey];

    if (!cached) {
        return null;
    }

    if (Date.now() - cached.timestamp < CACHE_EXPIRY_MS) {
        return cached.data;
    }
    await localStorage.remove(cacheKey);
    return null;
}

async function setCachedFriendData(friend, data) {
    const cacheKey = `friend_cache_${friend}`;
    await localStorage.set({ [cacheKey]: { data, timestamp: Date.now() } });
}

async function clearFriendCache(friend) {
    if (friend) {
        await localStorage.remove(`friend_cache_${friend}`);
        return;
    }

    const all = await localStorage.get(null);
    const cacheKeys = Object.keys(all).filter(key => key.startsWith("friend_cache_"));
    if (cacheKeys.length > 0) {
        await localStorage.remove(cacheKeys);
    }
}

async function fetchFriendData(friend, retries = 2) {
    const cached = await getCachedFriendData(friend);
    if (cached) {
        return cached;
    }

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const friendObject = await fetch(`https://profile.intra.42.fr/users/${friend}`, {
                credentials: "include"
            }).then(res => res.json());

            if (!Object.keys(friendObject).length) {
                return null;
            }

            const logTimeObject = await fetch(`https://translate.intra.42.fr/users/${friend}/locations_stats.json`, {
                credentials: "include"
            }).then(res => res.json());

            const data = { friend, friend_object: friendObject, log_time_object: logTimeObject };
            await setCachedFriendData(friend, data);
            return data;
        } catch (error) {
            if (attempt === retries) {
                console.warn(`Failed to load data for ${friend} after ${retries + 1} attempts`, error);
                throw error;
            }
            await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        }
    }

    return null;
}

const OVERLAY_ID = "tf-friends-overlay";
const STORAGE_KEYS = {
    collapsed: "tf_overlay_collapsed",
    width: "tf_overlay_width"
};

async function getOverlayState(key, fallback) {
    const result = await syncStorage.get(key);
    return result[key] !== undefined ? result[key] : fallback;
}

function displayFriend(content, friend, today, friendObject, logTimeObject) {
    try {
        const item = document.createElement("div");
        item.style.cssText = `
            display:flex;
            align-items:center;
            gap:12px;
            margin-bottom:10px;
            cursor:pointer;
            transition:background .2s ease, transform .2s ease;
            padding:10px 12px;
            border-radius:14px;
            background:#222732;
            border:1px solid rgba(255,255,255,.04);
        `;
        item.addEventListener("mouseover", () => {
            item.style.background = "#2a303c";
            item.style.transform = "translateY(-1px)";
        });
        item.addEventListener("mouseout", () => {
            item.style.background = "#222732";
            item.style.transform = "translateY(0)";
        });
        item.addEventListener("click", () => window.open(`https://profile.intra.42.fr/users/${friend}`, "_blank"));

        const photo = document.createElement("div");
        photo.className = "user-profile-picture visible-sidebars";
        photo.style.cssText = `
            background-image:url(${friendObject.image.link});
            background-size:cover;
            width:42px;
            height:42px;
            border-radius:50%;
            background-position:50% 50%;
            flex:0 0 auto;
        `;

        const details = document.createElement("div");
        details.style.cssText = "display:flex;flex-direction:column;gap:4px;min-width:0;";

        const login = document.createElement("div");
        login.textContent = friend;
        login.style.cssText = "font-weight:700;font-size:14px;color:#f5f7fa;";

        const infoDisplay = document.createElement("div");
        infoDisplay.style.cssText = "font-size:12px;color:#aab3bf;";
        if (logTimeObject[today]) {
            const [dailyHours, dailyMinutes] = logTimeObject[today].split(":");
            infoDisplay.textContent = `${dailyHours}h${dailyMinutes || "00"} today`;
        } else {
            infoDisplay.textContent = "0h00 today";
        }

        details.appendChild(login);
        details.appendChild(infoDisplay);

        const clusterBox = document.createElement("div");
        clusterBox.style.cssText = "margin-left:auto;display:flex;align-items:center;gap:10px;";

        const clusterPosition = document.createElement("div");
        clusterPosition.style.cssText = "font-size:12px;color:#b8c0cc;max-width:100px;text-align:right;";
        if (friendObject.location) {
            clusterPosition.textContent = friendObject.location;
            clusterPosition.style.cursor = "pointer";
            clusterPosition.style.color = "#4fd7ff";
            clusterPosition.onclick = (event) => {
                event.stopPropagation();
                window.open(`https://meta.intra.42.fr/clusters#${friendObject.location}`, "_blank");
            };
            addTooltipOnHover(clusterPosition, "Open cluster map");
        } else {
            clusterPosition.textContent = "Offline";
        }

        const status = document.createElement("div");
        status.style.cssText = `
            width:10px;
            height:10px;
            border-radius:50%;
            background:${friendObject.location ? "#4BE36A" : "#ff5f56"};
            box-shadow:0 0 0 3px rgba(255,255,255,.05);
        `;

        const deleteFriend = document.createElement("button");
        deleteFriend.type = "button";
        deleteFriend.textContent = "✕";
        deleteFriend.style.cssText = `
            appearance:none;
            border:none;
            background:transparent;
            color:#93a0b1;
            font-size:14px;
            cursor:pointer;
            padding:0 4px;
            margin-left:6px;
        `;
        addTooltipOnHover(deleteFriend, "Delete friend");
        deleteFriend.onclick = async (event) => {
            event.stopPropagation();

            if (!confirm(`Delete ${friend} from your friend list?`)) {
                return;
            }

            const currentList = await getFriendList();
            const updatedList = currentList.filter(value => value !== friend);
            await saveFriendList(updatedList);
            item.remove();

            if (!updatedList.length) {
                await renderFriendsOverlay(content.closest(".tf-friends-body"));
            }
        };

        clusterBox.appendChild(clusterPosition);
        clusterBox.appendChild(status);
        clusterBox.appendChild(deleteFriend);

        item.appendChild(photo);
        item.appendChild(details);
        item.appendChild(clusterBox);

        content.appendChild(item);
    } catch (error) {
        console.warn(`Failed to display data for ${friend}`, error);
    }
}

async function renderFriendsList(content, sortPreference) {
    const today = new Date().toISOString().split("T")[0];
    let friendList = await getFriendList();

    content.innerHTML = "";

    const loadingDiv = document.createElement("div");
    loadingDiv.style.cssText = "display:flex;flex-direction:column;align-items:center;justify-content:center;height:220px;color:#f2f2f2;";
    loadingDiv.innerHTML = `
        <div style="font-size:16px;margin-bottom:10px;">Loading friends...</div>
        <div style="width:30px;height:30px;border:3px solid #f2f2f2;border-top:3px solid transparent;border-radius:50%;animation:tf-spin 1s linear infinite;"></div>
    `;
    content.appendChild(loadingDiv);

    if (!friendList.length) {
        content.innerHTML = `
            <div style="padding:18px;">
                <div style="width:100%;min-height:180px;border:2px dashed rgba(255,255,255,.18);border-radius:16px;display:flex;align-items:center;justify-content:center;color:#c6cfda;font-size:15px;text-align:center;padding:24px;background:#20242d;">
                    Add friends to show them here
                </div>
            </div>
        `;
        return;
    }

    try {
        const friendPromises = friendList.map(friend => fetchFriendData(friend));
        const results = await Promise.all(friendPromises);
        const friendDataList = results.filter(data => data !== null);

        if (friendDataList.length !== friendList.length) {
            const validFriends = friendDataList.map(data => data.friend);
            await saveFriendList(validFriends);
            friendList = validFriends;
        }

        switch (sortPreference) {
            case "Alphabetical (A-Z)":
                friendDataList.sort((a, b) => a.friend.localeCompare(b.friend));
                break;
            case "Alphabetical (Z-A)":
                friendDataList.sort((a, b) => b.friend.localeCompare(a.friend));
                break;
            case "Online First":
                friendDataList.sort((a, b) => (b.friend_object.location ? 1 : 0) - (a.friend_object.location ? 1 : 0));
                break;
            case "Offline First":
                friendDataList.sort((a, b) => (a.friend_object.location ? 1 : 0) - (b.friend_object.location ? 1 : 0));
                break;
        }

        content.innerHTML = "";
        const list = document.createElement("div");
        list.style.cssText = "max-height:420px;overflow:auto;padding-right:4px;";
        content.appendChild(list);

        for (const data of friendDataList) {
            displayFriend(list, data.friend, today, data.friend_object, data.log_time_object);
        }
    } catch (error) {
        content.innerHTML = `
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:220px;color:#f2f2f2;padding:20px;text-align:center;">
                <div style="font-size:16px;margin-bottom:10px;color:#ff6b6b;">Failed to load friends</div>
                <div style="font-size:14px;margin-bottom:15px;opacity:.8;">There was an error loading your friend list</div>
                <button id="retry-friends-btn" type="button" style="padding:8px 16px;background-color:#4a90e2;color:white;border:none;border-radius:8px;cursor:pointer;font-size:14px;">Retry</button>
            </div>
        `;
        const retry = content.querySelector("#retry-friends-btn");
        if (retry) {
            retry.onclick = () => renderFriendsList(content, sortPreference);
        }
    }
}

async function createFriendsToolbar(targetPanel, listContainer) {
    const sortResult = await syncStorage.get("friend_sort");
    const sortPreference = sortResult.friend_sort || "Alphabetical (A-Z)";
    const wrapper = document.createElement("div");
    wrapper.style.cssText = "display:flex;flex-direction:column;gap:12px;margin-bottom:14px;";

    const topRow = document.createElement("div");
    topRow.style.cssText = "display:flex;gap:10px;align-items:center;";

    const input = document.createElement("input");
    input.placeholder = "Enter login";
    input.style.cssText = `
        flex:1;
        min-width:0;
        padding:12px 14px;
        color:white;
        background-color:#242a34;
        border:1px solid rgba(255,255,255,.08);
        border-radius:12px;
        outline:none;
        font-size:14px;
    `;

    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.textContent = "Add";
    addButton.style.cssText = `
        appearance:none;
        border:none;
        padding:12px 14px;
        border-radius:12px;
        background:linear-gradient(180deg,#24d8e3,#13b9c5);
        color:#061116;
        font-weight:800;
        cursor:pointer;
    `;

    async function addFriend() {
        const newFriend = input.value.trim().toLowerCase();
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
        const currentSort = await syncStorage.get("friend_sort");
        await renderFriendsList(listContainer, currentSort.friend_sort || "Alphabetical (A-Z)");
    }

    input.addEventListener("keydown", async (event) => {
        if (event.key === "Enter") {
            await addFriend();
        }
    });
    addButton.onclick = addFriend;

    topRow.appendChild(input);
    topRow.appendChild(addButton);

    const bottomRow = document.createElement("div");
    bottomRow.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:10px;";

    const sortLabel = document.createElement("div");
    sortLabel.textContent = "Sort:";
    sortLabel.style.cssText = "font-size:13px;color:#aab3bf;font-weight:600;";

    const select = document.createElement("select");
    select.style.cssText = `
        margin-left:auto;
        padding:10px 12px;
        border-radius:12px;
        background:#242a34;
        color:#f5f7fa;
        border:1px solid rgba(255,255,255,.08);
        font-size:13px;
        outline:none;
    `;

    ["Alphabetical (A-Z)", "Alphabetical (Z-A)", "Online First", "Offline First"].forEach(optionText => {
        const option = document.createElement("option");
        option.value = optionText;
        option.textContent = optionText;
        option.selected = optionText === sortPreference;
        select.appendChild(option);
    });

    select.onchange = async () => {
        await syncStorage.set({ friend_sort: select.value });
        await renderFriendsList(listContainer, select.value);
    };

    bottomRow.appendChild(sortLabel);
    bottomRow.appendChild(select);

    wrapper.appendChild(topRow);
    wrapper.appendChild(bottomRow);
    targetPanel.appendChild(wrapper);
}

async function renderFriendsOverlay(body) {
    body.innerHTML = "";

    const toolbarContainer = document.createElement("div");
    const listContainer = document.createElement("div");

    body.appendChild(toolbarContainer);
    body.appendChild(listContainer);

    await createFriendsToolbar(toolbarContainer, listContainer);
    const sortResult = await syncStorage.get("friend_sort");
    await renderFriendsList(listContainer, sortResult.friend_sort || "Alphabetical (A-Z)");
}

async function buildOverlay() {
    if (document.getElementById(OVERLAY_ID)) {
        return document.getElementById(OVERLAY_ID);
    }

    const collapsed = await getOverlayState(STORAGE_KEYS.collapsed, "false") === "true";
    const savedWidth = await getOverlayState(STORAGE_KEYS.width, "360");

    const overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    overlay.style.cssText = `
        position:fixed;
        right:24px;
        bottom:24px;
        width:${savedWidth}px;
        max-width:min(92vw, 420px);
        min-width:320px;
        color:#f5f7fa;
        font-family:Inter,Arial,sans-serif;
        z-index:99999;
        border-radius:18px;
        background:rgba(17,21,27,.96);
        box-shadow:0 18px 45px rgba(0,0,0,.35);
        border:1px solid rgba(255,255,255,.08);
        backdrop-filter:blur(12px);
        overflow:hidden;
    `;

    const header = document.createElement("div");
    header.style.cssText = `
        display:flex;
        align-items:center;
        justify-content:space-between;
        padding:16px 18px;
        background:linear-gradient(180deg,#1de0ea,#15b9c5);
        color:#092026;
        font-weight:800;
        font-size:18px;
        cursor:pointer;
        user-select:none;
    `;

    const title = document.createElement("div");
    title.textContent = "Friends Tracker";
    title.style.display = "flex";
    title.style.alignItems = "center";
    title.style.gap = "8px";

    const titleDot = document.createElement("span");
    titleDot.textContent = "●";
    titleDot.style.fontSize = "14px";
    titleDot.style.opacity = ".8";
    title.prepend(titleDot);

    const headerActions = document.createElement("div");
    headerActions.style.cssText = "display:flex;align-items:center;gap:10px;font-size:14px;";

    const refreshButton = document.createElement("button");
    refreshButton.type = "button";
    refreshButton.textContent = "↻";
    refreshButton.style.cssText = `
        appearance:none;
        border:none;
        background:rgba(9,32,38,.14);
        color:#092026;
        width:28px;
        height:28px;
        border-radius:50%;
        cursor:pointer;
        font-size:16px;
        font-weight:700;
    `;
    refreshButton.title = "Refresh friends";

    const collapseIcon = document.createElement("span");
    collapseIcon.textContent = collapsed ? "▸" : "▾";
    collapseIcon.style.fontSize = "18px";
    collapseIcon.style.fontWeight = "900";

    headerActions.appendChild(refreshButton);
    headerActions.appendChild(collapseIcon);

    header.appendChild(title);
    header.appendChild(headerActions);

    const body = document.createElement("div");
    body.className = "tf-friends-body";
    body.style.cssText = `
        display:${collapsed ? "none" : "block"};
        padding:14px;
        background:linear-gradient(180deg,rgba(28,31,39,.98),rgba(16,18,24,.98));
    `;

    refreshButton.onclick = async (e) => {
        e.stopPropagation();
        await clearFriendCache();
        await renderFriendsOverlay(body);
    };

    header.addEventListener("click", () => {
        const isCollapsed = body.style.display === "none";
        body.style.display = isCollapsed ? "block" : "none";
        collapseIcon.textContent = isCollapsed ? "▾" : "▸";
        syncStorage.set({ [STORAGE_KEYS.collapsed]: isCollapsed ? "false" : "true" });
    });

    overlay.appendChild(header);
    overlay.appendChild(body);
    document.body.appendChild(overlay);

    makeOverlayDraggable(overlay, header);
    renderFriendsOverlay(body);

    return overlay;
}

function makeOverlayDraggable(overlay, dragHandle) {
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let startRight = 24;
    let startBottom = 24;

    dragHandle.addEventListener("mousedown", (event) => {
        if (event.target.tagName === "BUTTON") {
            return;
        }
        isDragging = true;
        startX = event.clientX;
        startY = event.clientY;
        startRight = parseInt(window.getComputedStyle(overlay).right, 10) || 24;
        startBottom = parseInt(window.getComputedStyle(overlay).bottom, 10) || 24;
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

function injectSharedStyles() {
    if (document.getElementById("tf-friends-styles")) {
        return;
    }

    const style = document.createElement("style");
    style.id = "tf-friends-styles";
    style.textContent = `
        @keyframes tf-spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }

        #${OVERLAY_ID} ::-webkit-scrollbar {
            width: 8px;
            height: 8px;
        }

        #${OVERLAY_ID} ::-webkit-scrollbar-thumb {
            background: rgba(255,255,255,.14);
            border-radius: 999px;
        }

        #${OVERLAY_ID} ::-webkit-scrollbar-track {
            background: transparent;
        }

        #tf-profile-friend-btn {
            margin-left: 10px;
            margin-right: 10px;
            padding: 4px 10px;
            border-radius: 999px;
            border: 1px solid transparent;
            font-size: 12px;
            font-weight: 700;
            line-height: 1.2;
            cursor: pointer;
            transition: background-color .18s ease, border-color .18s ease, color .18s ease;
        }

        #tf-profile-friend-btn[data-mode="add"] {
            color: #0f311b;
            background: #6ee7a0;
            border-color: #45cc82;
        }

        #tf-profile-friend-btn[data-mode="remove"] {
            color: #3a1212;
            background: #ff9a9a;
            border-color: #f27777;
        }
    `;
    document.head.appendChild(style);
}

const PROFILE_FRIEND_BUTTON_ID = "tf-profile-friend-btn";
let profileObserverInitialized = false;
let profileButtonUpdateInProgress = false;
let profileUrlWatcher = null;

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
    const login = (loginFromData || loginFromPath).toLowerCase();

    if (!login) {
        return null;
    }

    return { login, loginElement };
}

async function refreshOverlayIfPresent() {
    const overlayBody = document.querySelector(".tf-friends-body");
    if (!overlayBody) {
        return;
    }
    await renderFriendsOverlay(overlayBody);
}

async function renderProfileFriendButton() {
    const context = getProfileLoginContext();
    const existingButton = document.getElementById(PROFILE_FRIEND_BUTTON_ID);

    if (!context) {
        if (existingButton) {
            existingButton.remove();
        }
        return;
    }

    const { login, loginElement } = context;
    let button = existingButton;

    if (!button) {
        button = document.createElement("button");
        button.id = PROFILE_FRIEND_BUTTON_ID;
        button.type = "button";
    }

    if (loginElement.nextElementSibling !== button) {
        loginElement.insertAdjacentElement("afterend", button);
    }

    button.dataset.login = login;

    const friendList = await getFriendList();
    const isFriend = friendList.includes(login);
    button.dataset.mode = isFriend ? "remove" : "add";
    button.textContent = isFriend ? "Remove Friend" : "Add Friend";

    button.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const targetLogin = (button.dataset.login || "").trim().toLowerCase();
        if (!targetLogin) {
            return;
        }

        const currentList = await getFriendList();
        const alreadyFriend = currentList.includes(targetLogin);

        if (alreadyFriend) {
            const nextList = currentList.filter((value) => value !== targetLogin);
            await saveFriendList(nextList);
            await clearFriendCache(targetLogin);
        } else {
            const nextList = [...currentList, targetLogin];
            await saveFriendList(nextList);
        }

        await renderProfileFriendButton();
        await refreshOverlayIfPresent();
    };
}

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

function initProfileFriendButton() {
    if (profileObserverInitialized) {
        return;
    }
    profileObserverInitialized = true;

    const observer = new MutationObserver(() => {
        updateProfileFriendButton();
    });

    observer.observe(document.body, { childList: true, subtree: true });

    let previousUrl = window.location.href;
    profileUrlWatcher = window.setInterval(() => {
        const currentUrl = window.location.href;
        if (currentUrl !== previousUrl) {
            previousUrl = currentUrl;
            updateProfileFriendButton();
        }
    }, 500);

    window.addEventListener("popstate", updateProfileFriendButton);
    window.addEventListener("hashchange", updateProfileFriendButton);

    updateProfileFriendButton();
}

function init() {
    injectSharedStyles();
    buildOverlay();
    initProfileFriendButton();
}

if (!window.__42_FRIENDS_LOADED__) {
    window.__42_FRIENDS_LOADED__ = true;
    init();
}