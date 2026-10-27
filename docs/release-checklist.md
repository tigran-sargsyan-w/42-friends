# 42 Friends 0.1.6 — minimal rate-limit fix

- [ ] CI build and automated tests pass.
- [ ] Load the ZIP's unpacked extension in Chrome (unzip archive containing manifest.json).
- [ ] Use the same 42 Intra session and verify the friend cards have avatars, real locations and logtimes.
- [ ] Verify saved friends and pinned preferences from v0.1.5 remain intact.
- [ ] Confirm the original content script sends requests; there is no background worker.
- [ ] With 31 saved friends, visible cards appear immediately; uncached values update in batches.
- [ ] The Refresh button retains the displayed list while refetching only data older than 60 seconds.
- [ ] Confirm a real HTTP 429 pauses new batches as directed by Retry-After, without repeated aggressive requests.
- [ ] Verify sorting, add/remove friend, profile button, pin/unpin, scroll and tooltip behavior.
- [ ] Test multiple Intra tabs without causing rate limit. (Currently cooldown is shared, batches are per tab.)
- [ ] Only after successful manual tests: merge PR, package, submit update to existing Chrome Web Store listing.
