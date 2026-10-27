/**
 * Rate budget state (pure logic). All Chrome tabs share a single owner,
 * but HTTP requests themselves stay in the original content script.
 */
export const MIN_INTERVAL_MS = 3000;
export const MAX_INTERVAL_MS = 15000;
export const COOLDOWN_MARGIN_MS = 5000;

export class RateBudget {
    constructor(state = {}, now = Date.now) {
        this.now = now;
        this.intervalMs = Number.isFinite(state.intervalMs)
            ? Math.min(MAX_INTERVAL_MS, Math.max(MIN_INTERVAL_MS, state.intervalMs))
            : MIN_INTERVAL_MS;
        this.cooldownUntil = Math.max(0, Number(state.cooldownUntil) || 0);
        this.nextAt = Math.max(0, Number(state.nextAt) || 0);
        this.successes = Math.max(0, Number(state.successes) || 0);
    }

    serialize() {
        return {
            intervalMs: this.intervalMs,
            cooldownUntil: this.cooldownUntil,
            nextAt: this.nextAt,
            successes: this.successes
        };
    }

    reserve() {
        const now = this.now();
        if (now < this.cooldownUntil) {
            return { blocked: true, cooldownUntil: this.cooldownUntil };
        }
        const at = Math.max(now, this.nextAt);
        this.nextAt = at + this.intervalMs;
        return { blocked: false, at };
    }

    check() {
        return {
            blocked: this.now() < this.cooldownUntil,
            cooldownUntil: this.cooldownUntil
        };
    }

    limited(retryAfterMs) {
        const delay = Number.isFinite(retryAfterMs)
            ? Math.max(1000, Math.min(retryAfterMs, 300000))
            : 30000;
        this.cooldownUntil = Math.max(
            this.cooldownUntil,
            this.now() + delay + COOLDOWN_MARGIN_MS
        );
        this.nextAt = Math.max(this.nextAt, this.cooldownUntil);
        this.intervalMs = Math.min(MAX_INTERVAL_MS, Math.round(this.intervalMs * 1.75));
        this.successes = 0;
        return this.check();
    }

    succeeded() {
        this.successes += 1;
        if (this.successes >= 20) {
            this.intervalMs = Math.max(MIN_INTERVAL_MS, Math.round(this.intervalMs * 0.9));
            this.successes = 0;
        }
        return { intervalMs: this.intervalMs };
    }
}
