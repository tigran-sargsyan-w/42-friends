/**
 * Shared request scheduler for the 42 internal endpoints.
 * No Chrome APIs here: the scheduler is independently unit-testable.
 */
export function parseRetryAfter(value, now = Date.now()) {
    if (!value) return null;
    const raw = String(value).trim();
    if (/^\d+$/.test(raw)) return Math.max(0, Number(raw) * 1000);
    const date = Date.parse(raw);
    return Number.isFinite(date) ? Math.max(0, date - now) : null;
}

export class RequestError extends Error {
    constructor(code, message, details = {}) {
        super(message);
        this.name = "RequestError";
        this.code = code;
        Object.assign(this, details);
    }
}

export class RequestScheduler {
    constructor({
        fetchImpl = fetch,
        now = Date.now,
        wait = ms => new Promise(resolve => setTimeout(resolve, ms)),
        minIntervalMs = 1800,
        maxQueueSize = 60,
        initialCooldownUntil = 0,
        persistCooldown = async () => {}
    } = {}) {
        this.fetchImpl = fetchImpl;
        this.now = now;
        this.wait = wait;
        this.minIntervalMs = minIntervalMs;
        this.maxQueueSize = maxQueueSize;
        this.persistCooldown = persistCooldown;
        this.cooldownUntil = initialCooldownUntil;
        this.nextAllowedAt = 0;
        this.consecutiveRateLimits = 0;
        this.queue = [];
        this.pending = new Map();
        this.running = false;
    }

    rateLimitError() {
        return new RequestError("rate_limited", "42 Intra temporarily limited requests", {
            cooldownUntil: this.cooldownUntil,
            retryAfterMs: Math.max(0, this.cooldownUntil - this.now())
        });
    }

    request(url) {
        // Deduplicate overlapping requests, including those from separate tabs.
        if (this.pending.has(url)) return this.pending.get(url);
        if (this.now() < this.cooldownUntil) return Promise.reject(this.rateLimitError());
        // Avoid responses waiting beyond the service worker event lifetime.
        if (this.queue.length >= this.maxQueueSize) {
            return Promise.reject(new RequestError("queue_busy", "Friend updates are queued", {
                cooldownUntil: this.now() + 120000, retryAfterMs: 120000
            }));
        }

        const promise = new Promise((resolve, reject) => {
            this.queue.push({ url, resolve, reject });
        });
        this.pending.set(url, promise);
        promise.then(
            () => this.pending.delete(url),
            () => this.pending.delete(url)
        );
        void this.pump();
        return promise;
    }

    async pump() {
        if (this.running) return;
        this.running = true;
        try {
            while (this.queue.length) {
                if (this.now() < this.cooldownUntil) {
                    this.rejectQueued(this.rateLimitError());
                    break;
                }

                const delay = Math.max(0, this.nextAllowedAt - this.now());
                if (delay) await this.wait(delay);
                if (this.now() < this.cooldownUntil) {
                    this.rejectQueued(this.rateLimitError());
                    break;
                }

                const task = this.queue.shift();
                this.nextAllowedAt = this.now() + this.minIntervalMs;
                try {
                    const response = await this.fetchImpl(task.url, {
                        credentials: "include",
                        signal: AbortSignal.timeout(15000)
                    });

                    if (response.status === 429) {
                        const retryAfter = parseRetryAfter(response.headers.get("Retry-After"), this.now());
                        const fallback = Math.min(300000, 30000 * (2 ** Math.min(this.consecutiveRateLimits, 3)));
                        this.consecutiveRateLimits++;
                        // Even a zero-second server hint gets a small safety margin.
                        const pause = Math.max(1000, retryAfter ?? fallback);
                        this.cooldownUntil = this.now() + pause;
                        try {
                            await this.persistCooldown(this.cooldownUntil);
                        } catch (error) {
                            console.warn("42 Friends: unable to persist rate-limit cooldown", error);
                        }
                        const err = this.rateLimitError();
                        task.reject(err);
                        this.rejectQueued(err);
                        break;
                    }

                    if (response.status === 404) {
                        throw new RequestError("not_found", "42 Intra user data not found");
                    }
                    if (response.status === 401 || response.status === 403) {
                        throw new RequestError("unauthorized", "42 Intra session is unavailable");
                    }
                    if (!response.ok) {
                        throw new RequestError("http_error", `42 Intra returned HTTP ${response.status}`, {
                            status: response.status
                        });
                    }

                    // Like the original extension, parse successful JSON responses
                    // regardless of Content-Type (internal 42 endpoints may mislabel it).
                    let data;
                    try {
                        data = await response.json();
                    } catch {
                        throw new RequestError("invalid_response", "42 Intra returned malformed JSON");
                    }
                    this.consecutiveRateLimits = 0;
                    task.resolve(data);
                } catch (error) {
                    const normalized = error instanceof RequestError
                        ? error
                        : new RequestError("network_error", String(error?.message || error));
                    task.reject(normalized);
                    // A missing session or an HTML response instead of JSON often
                    // affects every friend. Stop the remaining batch immediately.
                    // Unlike 429, we do not retry automatically on these errors.
                    if (normalized.code === "unauthorized" ||
                        normalized.code === "invalid_response") {
                        this.rejectQueued(normalized);
                        break;
                    }
                }
            }
        } finally {
            this.running = false;
            if (this.queue.length) void this.pump();
        }
    }

    rejectQueued(error) {
        for (const task of this.queue.splice(0)) task.reject(error);
    }
}
