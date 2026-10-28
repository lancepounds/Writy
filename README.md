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

## Rich-text editing and formatting

Click **Rich text** next to the document title to switch to the WYSIWYG editor: the page itself becomes editable, and bold, italics, underlining, headings, lists, fonts, text sizes, and paragraph alignment are visible as you type. Click **Plain text** to return to Writy's original writing editor. Use **Format** to expand or collapse the toolbar. The rich-text choice is remembered on this device.

In **Rich text** mode, word suggestions appear in a row at the top, with Tab or a suggestion click inserting the chosen word. Cursor-based word trees, mouse words, and other specialized prediction layouts remain available in the original plain-text editor. The original text entry path is unchanged for eye tracking, switch access, on-screen keys, and other advanced input workflows; please test those on your actual device before relying on rich mode.

**How documents are saved:** Rich HTML and a plain-text copy are saved together in Writy's local IndexedDB document and revision history, the localStorage fallback, and downloaded backup files. Older plain-text documents open in rich mode with their existing markup rendered. Word (.doc) export uses the saved rich formatting when present. For safety, copied material pasted into rich mode is inserted as text, and saved HTML is restricted to supported formatting tags.

**Important:** Editing a rich document in **Plain text** replaces its rich formatting with the plain-text changes. Use **Rich text** to retain styling. This is Word-like direct formatting, not complete Microsoft Word compatibility: there are not yet document tables, page breaks, headers/footers, tracked changes, or full DOCX import/export. The original Markdown-style toolbar, preview, and plain-text documents still work.

## Code layout

- `writy.html`: writing UI, prediction engine, accessibility controls, and save/backup interface
- `writy-store.js`: IndexedDB persistence, safe migration support, on-device revisions, and conflict preservation
- `writy-sw.js`: service worker for offline caching
- `writy.webmanifest`: PWA installation metadata

The eventual native iOS version will require device testing and a native storage adapter; IndexedDB is a solid foundation for the web/PWA version but is not a substitute for native iOS file storage.

## iPad Safari testing (Writy 0.3)

Before testing, download a backup of any important documents from **Backup → Save backup file**. Safari and an installed home-screen version of Writy can have separate browser storage.

1. Open https://lancepounds.github.io/Writy/writy.html in Safari on your iPad and reload the page. If it appears unchanged, close the page and open it again.
2. Create a **test document**, write a sentence, confirm **Saved on this device**, and reload. Check that the sentence remains.
3. Switch between **Word tree**, **Radial dial**, **Drop-down menu**, **Whole phrases**, **Around my cursor**, **One box under it**, and **Bar at the top**. Check for clipped suggestions and tap a word to confirm that exactly one selection is inserted.
4. Rotate your iPad from portrait to landscape and back while a document is open. Check that no word buttons disappear and that writing and cursor position are preserved.
5. Toggle **Tablet mode** and Writy's **on-screen keyboard** (if you use it). Verify the editor still has usable space. Also try your iPad's software keyboard with Tablet mode off.
6. After a successful online load, turn on Airplane Mode and reopen the page without clearing its site data. Verify offline writing, closing/reopening and saving, then reconnect.
7. If you use VoiceOver, Switch Control, an eye tracker, or an alternative pointer, try the controls you normally use. Automated WebKit simulations **cannot** verify these physical-device interactions.

If something fails, report the layout mode, portrait/landscape, whether Tablet mode and Writy's on-screen keyboard were on, and what appeared to happen. Do not send the text of a private document.
