/**
 * Progressive friend-list rendering with stale-cache fallback.
 * A failed friend or rate limit never removes saved friends.
 */
import { CSS_CLASSES } from "../constants.js";
import { getTodayDateString } from "../utils.js";
import { getFriendList, cleanupPinnedFriends } from "../storage.js";
import { fetchFriendData, getFriendSnapshot } from "../api.js";
import { sortFriendDataList } from "../sorting.js";
import { createFriendItem } from "./friend-item.js";

const controllers = new WeakMap();

export async function renderFriendsList(container, sortPreference, onRefresh) {
    const previous = controllers.get(container);
    if (previous) previous.dispose();
    const controller = { active: true, timer: null, paintTimer: null, onVisible: null };
    controller.dispose = () => {
        controller.active = false;
        clearTimeout(controller.timer);
        clearTimeout(controller.paintTimer);
        if (controller.onVisible) document.removeEventListener("visibilitychange", controller.onVisible);
    };
    controllers.set(container, controller);

    const friendList = await getFriendList();
    if (!controller.active || !container.isConnected) return;
    const pinned = await cleanupPinnedFriends(friendList);
    if (!controller.active || !container.isConnected) return;
    const today = getTodayDateString();
    // Render saved logins immediately, even without a local cache or network.
    const byFriend = new Map(friendList.map(friend => [friend, {
        friend,
        friend_object: {},
        log_time_object: {},
        stale: true,
        logtimeStale: true,
        unavailable: true
    }]));
    let completed = 0;
    let cooldownUntil = 0;
    let failed = 0;
    const failureCodes = new Map();
    let loading = true;

    function paint() {
        if (!controller.active || !container.isConnected) return;
        document.querySelectorAll(`.${CSS_CLASSES.hoverCard}`).forEach(card => card.remove());
        container.replaceChildren();
        if (!friendList.length) {
            container.innerHTML = '<div class="tf-empty"><div class="tf-empty__box">Add friends to show them here</div></div>';
            return;
        }
        if (cooldownUntil > Date.now()) {
            const notice = document.createElement("div");
            notice.className = "tf-network-notice";
            notice.textContent = "Friend updates are paused to reduce 42 Intra traffic. Saved information stays visible; updates will resume automatically.";
            container.appendChild(notice);
        } else if (failed) {
            const notice = document.createElement("div");
            notice.className = "tf-network-notice";
            const codes = [...failureCodes.entries()].map(([code, count]) => `${code}: ${count}`).join(", ");
            notice.textContent = `Some friends could not be updated (${codes || "unknown error"}). Showing saved data where available.`;
            container.appendChild(notice);
        }

        const data = [...byFriend.values()];
        const pinnedData = data.filter(item => pinned.includes(item.friend));
        const regularData = data.filter(item => !pinned.includes(item.friend));
        sortFriendDataList(pinnedData, sortPreference);
        sortFriendDataList(regularData, sortPreference);
        const list = document.createElement("div");
        list.className = "tf-friends-list-scroll";
        container.appendChild(list);

        for (const [title, items, isPinned] of [
            ["Pinned", pinnedData, true],
            ["Friends", regularData, false]
        ]) {
            if (!items.length) continue;
            const heading = document.createElement("div");
            heading.className = CSS_CLASSES.sectionTitle;
            heading.textContent = title;
            list.appendChild(heading);
            for (const item of items) {
                createFriendItem({
                    container: list,
                    friend: item.friend,
                    today,
                    friendObject: item.friend_object,
                    logTimeObject: item.log_time_object,
                    isPinned,
                    isStale: item.stale || item.unavailable,
                    isLogtimeStale: item.logtimeStale,
                    onRefresh
                });
            }
        }
        if (loading) {
            const status = document.createElement("div");
            status.className = "tf-loading__text";
            status.textContent = `Loading friends… ${completed}/${friendList.length}`;
            container.appendChild(status);
        } else if (!data.length) {
            const error = document.createElement("div");
            error.className = "tf-error";
            error.innerHTML = '<div class="tf-error__title">Friends unavailable</div><div class="tf-error__message">42 Intra could not provide friend data.</div><button type="button" class="tf-error__retry">Retry</button>';
            error.querySelector("button").onclick = () => {
                if (Date.now() >= cooldownUntil) void renderFriendsList(container, sortPreference, onRefresh);
            };
            container.appendChild(error);
        }
    }

    function schedulePaint() {
        if (controller.paintTimer !== null) return;
        controller.paintTimer = setTimeout(() => {
            controller.paintTimer = null;
            paint();
        }, 100);
    }

    await Promise.all(friendList.map(async friend => {
        try {
            const snapshot = await getFriendSnapshot(friend);
            if (snapshot && controller.active && container.isConnected) byFriend.set(friend, snapshot);
        } catch (error) {
            console.warn("42 Friends: cache read failed", error);
        }
    }));
    if (!controller.active || !container.isConnected) return;
    paint();

    const ordered = [...friendList.filter(friend => pinned.includes(friend)),
        ...friendList.filter(friend => !pinned.includes(friend))];
    await Promise.all(ordered.map(async friend => {
        try {
            const result = await fetchFriendData(friend, partial => {
                if (!controller.active || !container.isConnected) return;
                byFriend.set(friend, partial);
                schedulePaint();
            });
            if (!controller.active || !container.isConnected) return;
            if (result.error) {
                failed++;
                const code = result.error.code || "unknown";
                failureCodes.set(code, (failureCodes.get(code) || 0) + 1);
                if (result.error.code === "rate_limited" || result.error.code === "queue_busy") {
                    cooldownUntil = Math.max(cooldownUntil, Number(result.error.cooldownUntil) || 0);
                }
            }
            byFriend.set(friend, result);
        } catch (error) {
            failed++;
            const code = error.code || "unknown";
            failureCodes.set(code, (failureCodes.get(code) || 0) + 1);
            console.warn(`42 Friends: unable to load ${friend}`, error);
        } finally {
            if (controller.active && container.isConnected) {
                completed++;
                schedulePaint();
            }
        }
    }));

    if (!controller.active || !container.isConnected) return;
    loading = false;
    clearTimeout(controller.paintTimer);
    controller.paintTimer = null;
    paint();

    if (cooldownUntil > Date.now()) {
        const resume = () => {
            if (!controller.active || !container.isConnected || document.visibilityState === "hidden") return;
            controller.dispose();
            void renderFriendsList(container, sortPreference, onRefresh);
        };
        controller.timer = setTimeout(resume, Math.max(1000, cooldownUntil - Date.now() + 300));
        controller.onVisible = () => {
            if (Date.now() >= cooldownUntil) resume();
        };
        document.addEventListener("visibilitychange", controller.onVisible);
    }
}
