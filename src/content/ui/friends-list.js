/**
 * Keep the v0.1.5 cards and controls. Populate them immediately from saved
 * logins/cache, then update in small batches using the original Intra fetches.
 */
import { CSS_CLASSES } from "../constants.js";
import { getTodayDateString } from "../utils.js";
import { getFriendList, cleanupPinnedFriends } from "../storage.js";
import { fetchFriendData, getCooldownUntil } from "../api.js";
import { getCachedFriendData } from "../cache.js";
import { loadInBatches, INITIAL_BATCH_SIZE, BATCH_GAP_MS } from "../batches.js";
import { sortFriendDataList } from "../sorting.js";
import { createFriendItem } from "./friend-item.js";

const activeLoads = new WeakMap();

function clearHelperPopups() {
    // Tooltips and hover cards are appended to document.body by v0.1.5.
    // Removing their old owners otherwise leaves their popups floating.
    document.querySelectorAll(`.${CSS_CLASSES.tooltip}, .${CSS_CLASSES.hoverCard}`)
        .forEach(element => element.remove());
}

export async function renderFriendsList(container, sortPreference, onRefresh) {
    activeLoads.get(container)?.cancel();
    const state = { active: true, timer: null, renderTimer: null };
    state.cancel = () => {
        state.active = false;
        clearTimeout(state.timer);
        clearTimeout(state.renderTimer);
    };
    activeLoads.set(container, state);
    const active = () => state.active && container.isConnected;
    const friendList = await getFriendList();
    if (!active()) return;
    const pinned = await cleanupPinnedFriends(friendList);
    if (!active()) return;

    const today = getTodayDateString();
    const rows = new Map();
    let processed = 0;
    let warning = "";
    let rateLimits = 0;
    let pending = [];
    let loading = true;

    function render() {
        if (!active()) return;
        const oldScrollTop = container.querySelector(".tf-friends-list-scroll")?.scrollTop || 0;
        clearHelperPopups();
        container.replaceChildren();

        if (!friendList.length) {
            const empty = document.createElement("div");
            empty.className = "tf-empty";
            empty.innerHTML = '<div class="tf-empty__box">Add friends to show them here</div>';
            container.appendChild(empty);
            return;
        }

        if (warning) {
            const message = document.createElement("div");
            message.className = "tf-network-notice";
            message.textContent = warning;
            container.appendChild(message);
        }

        const ordered = [...rows.values()];
        const pinnedRows = ordered.filter(row => pinned.includes(row.friend));
        const standardRows = ordered.filter(row => !pinned.includes(row.friend));
        sortFriendDataList(pinnedRows, sortPreference);
        sortFriendDataList(standardRows, sortPreference);

        const list = document.createElement("div");
        list.className = "tf-friends-list-scroll";
        container.appendChild(list);
        for (const [title, users, isPinned] of [
            ["Pinned", pinnedRows, true],
            ["Friends", standardRows, false]
        ]) {
            if (!users.length) continue;
            const heading = document.createElement("div");
            heading.className = CSS_CLASSES.sectionTitle;
            heading.textContent = title;
            list.appendChild(heading);
            for (const data of users) {
                createFriendItem({
                    container: list,
                    friend: data.friend,
                    today,
                    friendObject: data.friend_object,
                    logTimeObject: data.log_time_object,
                    isPinned,
                    isPending: data._pending,
                    isStale: data._stale,
                    isLogtimeStale: data._logtimeStale,
                    onRefresh
                });
            }
        }
        list.scrollTop = oldScrollTop;
        if (loading) {
            const progress = document.createElement("div");
            progress.className = "tf-load-progress";
            progress.textContent = `Updating friends… ${processed}/${friendList.length}`;
            container.insertBefore(progress, list);
        }
    }

    function scheduleRender() {
        if (state.renderTimer !== null) return;
        state.renderTimer = setTimeout(() => {
            state.renderTimer = null;
            render();
        }, 100);
    }

    // Never replace the visible list with a spinner.
    await Promise.all(friendList.map(async friend => {
        const cached = await getCachedFriendData(friend, { allowStale: true })
            .catch(() => null);
        rows.set(friend, cached
            ? { ...cached, friend, _pending: false }
            : { friend, friend_object: {}, log_time_object: {},
                _pending: true, _stale: true, _logtimeStale: true });
    }));
    if (!active()) return;

    const order = [
        ...friendList.filter(friend => pinned.includes(friend)),
        ...friendList.filter(friend => !pinned.includes(friend))
    ];

    // Fresh records have already been loaded from cache. Only stale/missing
    // records should hit Intra, and all reads happen in the content script.
    pending = order.filter(login => {
        const data = rows.get(login);
        return data._pending || data._stale || data._logtimeStale;
    });
    processed = friendList.length - pending.length;
    loading = pending.length > 0;
    render();
    if (!loading) return;

    async function refreshPending() {
        if (!active()) return;
        const outcome = await loadInBatches({
            friends: pending,
            load: friend => fetchFriendData(friend, partial => {
                if (!active()) return;
                const previous = rows.get(friend);
                rows.set(friend, {
                    ...previous, ...partial, friend, _pending: false
                });
                scheduleRender();
            }),
            active,
            batchSize: rateLimits ? 1 : INITIAL_BATCH_SIZE,
            gapMs: rateLimits ? 1500 : BATCH_GAP_MS,
            onResult(friend, data, error) {
                if (!active()) return;
                if (data) {
                    rows.set(friend, { ...data, friend, _pending: false });
                } else {
                    const previous = rows.get(friend);
                    const partial = error?.partial;
                    rows.set(friend, {
                        ...(partial || previous), friend,
                        _pending: false,
                        _stale: partial ? partial._stale : true,
                        _logtimeStale: partial ? partial._logtimeStale : true
                    });
                }
                scheduleRender();
            }
        });
        if (!active()) return;
        pending = outcome.remaining;
        processed = friendList.length - pending.length;
        loading = Boolean(pending.length);
        if (outcome.stopped === "rate_limited") {
            rateLimits++;
            if (rateLimits <= 2) {
                const deadline = Math.max(outcome.rateLimitedUntil, await getCooldownUntil());
                const delay = Math.max(1000, deadline - Date.now() + 500);
                warning = "42 Intra is limiting requests. Saved friends remain visible; updates will resume automatically.";
                state.timer = setTimeout(() => { if (active()) void refreshPending(); }, delay);
            } else {
                warning = "42 Intra is still limiting requests. Try refreshing later.";
                loading = false;
            }
        } else if (outcome.stopped && outcome.stopped !== "cancelled") {
            warning = `Could not update friends (${outcome.stopped}). Your saved list is unchanged.`;
            loading = false;
        } else {
            warning = outcome.failures ? "Some friends could not be updated; saved data remains visible." : "";
            loading = false;
        }
        render();
    }

    void refreshPending();
}
