# Writy

Writy is a locally running adaptive word-prediction writing application. The web version lives in `writy.html`. It can be installed as a Progressive Web App (PWA) for use without an internet connection once its files have been cached.

## Local-first documents

Writy is **local-first**, not a cloud editor. The app does not upload document text to a Writy server.

- **Primary save:** IndexedDB database `writy-local-v1`, using a `documents` store and an on-device `versions` history store.
- **Compatibility copy:** Existing `localStorage` documents (`sw.docs`) are migrated into IndexedDB without removing the originals. The app continues to write a localStorage copy for fallback and cross-window notifications.
- **Offline:** The service worker caches `writy.html`, `writy-store.js`, and the app's manifest and icons.
- **Recovery:** In **Backup → Previous versions of this document**, older locally saved drafts can be restored. Writy first saves a separate copy of the current draft during restoration.
- **Multiple windows:** Newer edits are prioritized. If another window replaces the currently visible text, Writy retains a separate **window conflict copy** under Documents. The IndexedDB store also archives incompatible incoming edits.
- **Fallback:** If IndexedDB is unavailable, the app uses localStorage and shows a less-protected storage status. If neither save works, Writy displays a clear warning.
- **Storage protection:** **Backup → Protect offline storage** requests persistent browser storage where supported.

**Important:** IndexedDB, localStorage, and PWA offline caches are still browser-managed data. They can disappear if the user clears site data, removes the installed app, or the operating system reclaims storage. Keep an independently downloaded backup file for important documents. An iOS installed PWA and Safari may have separate storage.

## Local-first manual regression checklist

Use non-sensitive test documents:

1. Open Writy, create a document, edit it, wait for **Saved on this device**, refresh, and verify the text.
2. Go offline after one successful online load; open Writy, edit a document, refresh while offline, and verify it still loads.
3. On an existing installation that previously stored documents in localStorage, update Writy and verify all old documents are present.
4. Edit the same document for longer than 30 seconds, then open **Backup → Previous versions**, restore an earlier draft, and verify the previously current text is still recoverable.
5. Open two tabs of Writy and edit the same document in each; check the conflict copy and saved history.
6. Export a backup file, open it to verify it contains your document text, and test restoration in a separate browser profile.
7. Disable storage or use a browser profile where IndexedDB is unavailable; verify Writy warns about browser-only storage and can still export work.
8. Install the PWA on iOS/iPadOS and separately verify offline startup and the browser-specific storage behavior.

## Code layout

- `writy.html`: writing UI, prediction engine, accessibility controls, and save/backup interface
- `writy-store.js`: IndexedDB persistence, safe migration support, on-device revisions, and conflict preservation
- `writy-sw.js`: service worker for offline caching
- `writy.webmanifest`: PWA installation metadata

The eventual native iOS version will require device testing and a native storage adapter; IndexedDB is a solid foundation for the web/PWA version but is not a substitute for native iOS file storage.
