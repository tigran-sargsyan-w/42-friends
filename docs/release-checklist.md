# 42 Friends — rate-limit stabilization release checklist

## Automated verification
- [ ] `npm ci && npm test && npm run build` passes.
- [ ] `build/manifest.json` references `content.js` and `background.js` (not `build/...`).
- [ ] Manifest permissions are unchanged apart from adding the background service worker.

## Manual Chrome tests — perform before merging
- [ ] Install `build/` using **Load unpacked** in a separate Chrome profile.
- [ ] Confirm profile and logtime requests are authenticated from the background service worker; if not, do not release until request context is fixed.
- [ ] Open Intra with one tab. Existing friends, avatars, logtime, pinned friends and sorting still work.
- [ ] Open 3 or more Intra tabs. Check Network for unexpected duplicated or simultaneous requests.
- [ ] Verify adding/removing a friend and the profile-page Add/Remove Friend button.
- [ ] Check the extension retains all saved friends and pinned preferences after updating from 0.1.5.
- [ ] Check no cached online status is reported as live during a network error.
- [ ] Observe normal reload without frequent HTTP 429; do **not** intentionally hammer the real 42 servers.
- [ ] Simulate 429 and Retry-After in automated tests rather than repeatedly provoking production limits.
- [ ] Check popup/resizing/dragging still works on several Intra pages.

## Release to Chrome Web Store
1. Confirm the current published version is lower than the version in `package.json`.
2. Merge the reviewed PR only after manual testing.
3. Check out `main`, run `npm ci && npm test && npm run build`.
4. From inside `build/`: `zip -r ../42-friends-v0.1.6.zip .`.
5. Inspect the archive root for `manifest.json`, `content.js`, `background.js`, and `icons/`.
6. Upload the ZIP to **the existing extension listing** in the Chrome Web Store Developer Dashboard.
7. Submit for review; consider deferred publishing if you want to control release timing.
8. Once approved and published, verify updating an existing install preserves stored friends and settings.
9. If serious issues arise, use the Web Store rollback capability and prepare a corrected higher version.

Do not claim that the release is deployed until the Web Store reports it as published.
