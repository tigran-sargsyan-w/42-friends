import { RequestScheduler } from "./scheduler.js";

const COOLDOWN_KEY = "tf_request_cooldown_until";
const BASE_PROFILE = "https://profile.intra.42.fr/users/";
const BASE_LOGTIME = "https://translate.intra.42.fr/users/";

const schedulerReady = chrome.storage.local.get(COOLDOWN_KEY).then(result =>
    new RequestScheduler({
        initialCooldownUntil: Number(result[COOLDOWN_KEY]) || 0,
        persistCooldown: until => chrome.storage.local.set({ [COOLDOWN_KEY]: until })
    })
);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "42-friends:fetch") return false;

    const login = message.login;
    const kind = message.kind;
    if (typeof login !== "string" || !/^[a-z0-9_-]{1,64}$/i.test(login) ||
        (kind !== "profile" && kind !== "logtime")) {
        sendResponse({ ok: false, error: { code: "invalid_request", message: "Invalid friend request" } });
        return false;
    }

    const encodedLogin = encodeURIComponent(login);
    const url = kind === "profile"
        ? BASE_PROFILE + encodedLogin
        : BASE_LOGTIME + encodedLogin + "/locations_stats.json";

    schedulerReady.then(scheduler => scheduler.request(url))
        .then(data => sendResponse({ ok: true, data }))
        .catch(error => sendResponse({
            ok: false,
            error: {
                code: error.code || "network_error",
                message: error.message || "Unknown request error",
                status: error.status,
                cooldownUntil: error.cooldownUntil,
                retryAfterMs: error.retryAfterMs
            }
        }));
    return true;
});
