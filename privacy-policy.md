# Privacy Policy for 42 Friends

**Last updated:** March 20, 2026

## Introduction

42 Friends ("the Extension") is a browser extension designed to help students of the 42 Network track their friends' online status and location within the intranet. This Privacy Policy explains how we handle information when you use our Extension.

## Information We Collect

### Data Stored in Browser

The Extension stores the following data using Chrome's storage APIs:

**Synced across your devices** (`chrome.storage.sync`):
- **Friend list**: Logins of users you add to your friend list
- **Pinned friends**: Your preferences for which friends are pinned
- **Sort preferences**: Your chosen sorting order for the friend list
- **Overlay state**: UI preferences (collapsed state, width)

**Stored locally on device** (`chrome.storage.local`):
- **Cached API responses**: Temporary cache of friend data to reduce requests to 42 intranet (expires automatically)

### Data We Do NOT Collect

- We do **not** collect any personal information about you
- We do **not** track your browsing activity
- We do **not** store your 42 intranet credentials
- We do **not** have any external servers — all data stays in your browser
- We do **not** use analytics, tracking, or telemetry tools

## Network Requests

The Extension makes requests to the **42 intranet** (not to any external servers) to fetch information about users you add to your friend list:

- `profile.intra.42.fr` — to get user profile data (name, location, level)
- `translate.intra.42.fr` — to get user log time statistics

These requests:
- Use your existing authenticated session on the 42 intranet
- Only fetch data for users you explicitly add to your friend list
- Are cached locally to minimize network usage
- Are subject to 42 Network's own Privacy Policy and Terms of Service

**We do not operate any servers.** The Extension only communicates with 42 intranet using your browser's existing session.

## Data Storage and Security

- Synced data (friend list, preferences) is stored in `chrome.storage.sync` and syncs across your Chrome browsers when signed in
- Cache data is stored locally in `chrome.storage.local` and does not sync
- No data is transmitted to any servers owned or operated by us
- You can clear all Extension data by removing the Extension or clearing browser data

## Your Rights and Choices

You have full control over your data:

- **View your data**: Your friend list is visible in the Extension overlay
- **Delete friends**: Remove any friend from your list at any time
- **Clear all data**: Uninstall the Extension to remove all stored data
- **Disable sync**: You can disable Chrome sync to prevent cross-device synchronization

## Children's Privacy

The Extension is intended for students of the 42 Network and is not directed at children under 13 years of age.

## Changes to This Policy

We may update this Privacy Policy from time to time. We will notify users of any material changes by updating the "Last updated" date at the top of this policy.

## Open Source

This Extension is open source. You can review the complete source code at:
https://github.com/tigran-sargsyan-w/42-friends

## Contact Us

If you have any questions about this Privacy Policy or the Extension, please:

- Open an issue on GitHub: https://github.com/tigran-sargsyan-w/42-friends/issues
- Contact the developer through the 42 intranet

---

By using the 42 Friends Extension, you agree to this Privacy Policy.
