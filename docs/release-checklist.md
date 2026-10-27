# 42 Friends 0.1.6 — adaptive rate-budget test checklist

- [ ] GitHub Actions: npm ci, npm test, npm run build, test artifact.
- [ ] Install unpacked test build in a separate Chrome profile. Ensure no two test extensions are enabled.
- [ ] Check existing synced friends, pins, sort settings, profile buttons, avatars and logtime.
- [ ] Verify requests to profile/translate execute from content.js, NOT background.js.
- [ ] Inspect the service worker: it only grants a global request-start budget.
- [ ] Open 3 Intra tabs and verify that requests from all tabs are spaced apart.
- [ ] Observe 429 behavior without deliberately flooding Intra: Retry-After plus safety margin, slower interval, automatic recovery.
- [ ] Reload the page. Cached cards appear immediately, refreshed data is reused, and no full request burst occurs.
- [ ] Compare profile and logtime refresh frequencies (4 min vs 15 min TTL).
- [ ] Refresh button must not invalidate all cached friends.
- [ ] Confirm full list loads and statuses are correct after an ordinary reload without 429.
- [ ] If 42 imposes stricter limits than configured, adjust the request budget rather than increasing concurrency.
- [ ] Only after real-browser verification, merge and prepare an update for the existing Chrome Web Store listing.

**Tradeoff:** first-time fetch of 31 profiles and logtime records cannot be both instant and safe under a strict server limit.
