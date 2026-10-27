/**
 * A tiny, testable batch runner. It limits concurrent users (not per-user
 * request delays), and stops after a rate limit rather than flooding Intra.
 */
export const INITIAL_BATCH_SIZE = 3;
export const BATCH_GAP_MS = 1000;

export const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function loadInBatches({
    friends,
    load,
    onResult,
    active = () => true,
    batchSize = INITIAL_BATCH_SIZE,
    gapMs = BATCH_GAP_MS,
    delay = wait
}) {
    const remaining = [...friends];
    let rateLimitedUntil = 0;
    let failures = 0;
    let errorCode = null;
    while (remaining.length && active()) {
        const group = remaining.splice(0, batchSize);
        const results = await Promise.allSettled(group.map(login => load(login)));
        let failedThisGroup = 0;
        for (let i = 0; i < results.length; i++) {
            if (!active()) return { remaining, stopped: "cancelled", failures };
            const result = results[i];
            if (result.status === "fulfilled") {
                onResult(group[i], result.value, null);
                continue;
            }
            failures++;
            failedThisGroup++;
            const error = result.reason;
            errorCode = error?.code || "network_error";
            onResult(group[i], null, error);
            if (errorCode === "rate_limited") {
                rateLimitedUntil = Math.max(rateLimitedUntil,
                    Number(error?.cooldownUntil) || Date.now() + 30000);
            }
        }
        if (rateLimitedUntil) {
            // Retry the failed items only after the server-provided cooldown.
            for (let i = group.length - 1; i >= 0; i--) {
                if (results[i].status === "rejected") remaining.unshift(group[i]);
            }
            return { remaining, stopped: "rate_limited", rateLimitedUntil, failures };
        }
        if (failedThisGroup === group.length &&
            ["network_error", "invalid_response", "unauthorized"].includes(errorCode)) {
            // A broken session or network should not trigger 31 failed requests.
            return { remaining, stopped: errorCode, failures };
        }
        if (remaining.length && active() && gapMs) await delay(gapMs);
    }
    return { remaining, stopped: active() ? null : "cancelled", failures };
}
