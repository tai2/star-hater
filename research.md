# Research: Cross-Platform Browser Extensions for Firefox & Chrome with the Browser Extensions API in TypeScript

> Research target: "How to develop a cross-platform browser addon/extension that runs on Firefox and Chrome using the Browser Extensions API in TypeScript."
>
> Note: The user wrote "Brosser" — interpreted as "Browser" (i.e. the WebExtensions / Browser Extensions API standardized by the W3C Browser Extensions Community Group).
>
> Project state at time of research: `/Users/tai2/star-hater` is an empty git repo (only `.git` exists). This document is a knowledge-gathering pass — there is no existing source to study. The findings below come from primary docs (MDN, Chrome for Developers, Firefox Extension Workshop), framework docs (WXT, Plasmo, Extension.js, CRXJS), the Mozilla `webextension-polyfill` repo, and current ecosystem articles.

---

## 1. Purpose

A "cross-platform browser extension" is a single codebase that ships an installable add-on to multiple browsers — primarily Chromium-family browsers (Chrome, Edge, Brave, Opera, Arc) and Gecko-family browsers (Firefox), with Safari often a stretch goal. The W3C **WebExtensions API** is the de-facto spec that makes this possible: all major browsers expose a near-identical surface for content scripts, background workers, storage, messaging, scripting injection, and UI surfaces (popups, options pages, side panels, devtools panels).

The point of using **TypeScript** is to gain compile-time guarantees over an API surface that is large, partially-implemented per browser, and historically inconsistent (Chrome's callback style vs. Firefox's promise style; `chrome.*` vs. `browser.*`; Manifest V2 vs. V3). Types catch the mismatches that would otherwise crash silently in one browser but not the other.

The core problems any cross-platform setup must solve:

1. **API namespace mismatch.** Firefox/Safari expose `globalThis.browser`; Chromium exposes `globalThis.chrome`. (Recent Chrome can also expose `browser` via the polyfill or via experimental support.)
2. **Promise vs. callback shape.** Chrome historically used callbacks; Firefox returns Promises. MV3 + recent Chrome versions converged on Promises, but old code and some APIs still expect callbacks.
3. **Manifest version & shape divergence.** Chrome MV3 mandates `background.service_worker` (string). Firefox MV3 prefers `background.scripts` (array) — Firefox does **not** ship service workers for extensions yet (event pages instead).
4. **Per-browser manifest keys.** `browser_specific_settings.gecko.id` is required by Firefox's AMO for MV3; Chrome ignores it. Conversely, `minimum_chrome_version` is a Chrome-only key.
5. **Build/packaging.** Each store wants a `.zip` of a directory containing `manifest.json` at root, with platform-correct background config.
6. **Distribution & signing.** Firefox requires signing through AMO (free); Chrome charges a one-time $5 dev fee and reviews automatically; Edge is free; Safari requires Xcode + an Apple developer account ($99/yr).

---

## 2. Architecture (the standard mental model)

### 2.1 Anatomy of a WebExtension

Every WebExtension — regardless of toolchain or language — is a directory with these conceptual parts:

```
extension-root/
├── manifest.json              # the only mandatory file; declares everything else
├── background.[js|ts]         # event-driven logic (service worker on Chrome, event page on Firefox)
├── content/*.[js|ts]          # scripts injected into matching web pages
├── popup/{popup.html, popup.[ts|tsx], popup.css}   # optional toolbar popup UI
├── options/{options.html, ...}                     # optional settings page
├── sidepanel/, devtools/, newtab/, ...             # optional UI surfaces
├── _locales/<lang>/messages.json                   # optional i18n
└── icons/ (16, 32, 48, 96, 128 px)
```

### 2.2 Execution contexts

The architecture is fundamentally **multi-context** — code runs in several isolated JS realms that talk via message passing:

| Context | Lifetime | Globals available | Cross-browser notes |
|---|---|---|---|
| **Background / service worker** | Chrome MV3: ephemeral SW (terminates after ~30 s idle); Firefox MV3: non-persistent event page (has `window`, `document`) | Chrome SW: no `window`, no `DOM`, no `XMLHttpRequest` (use `fetch`). Firefox event page: full DOM. | Biggest portability hazard. Anything DOM-touching breaks on Chrome. |
| **Content script** | Lives with the host page; isolated world by default | Sees host DOM, but **not** host page JS variables | Both browsers isolate; Firefox calls it "Xray vision," Chromium "isolated worlds." |
| **Popup / options / side panel** | Document scripts; behave like normal web pages running on the extension origin | Full DOM, full extension API | Same on both. Popup unmounts on close — never assume continuity. |
| **Injected script (MAIN world)** | Runs in the page's own realm | Sees page JS variables; **cannot** call extension APIs | Used to bridge page-script and extension via `postMessage` + DOM events. |
| **DevTools panel** | Per-devtools instance | DevTools-specific APIs | Same on both browsers. |

### 2.3 The two cross-browser strategies

There are essentially two patterns for sharing code:

**Strategy A — `webextension-polyfill` (manual / minimal)**
Use Mozilla's `webextension-polyfill` (a UMD bundle, `browser-polyfill.js`) as the first script in every manifest entry. It detects whether `globalThis.browser` already exists (Firefox: yes → no-op) or wraps `chrome.*` to expose a Promise-based `browser.*` (Chrome). You then write all code against `browser.*` only. TypeScript types come from `@types/webextension-polyfill` (auto-generated from Mozilla schemas).

**Strategy B — frameworks that abstract the gap (WXT, Plasmo, Extension.js, CRXJS)**
File-based entrypoints, automatic manifest generation, hot module replacement, multi-browser builds from a single source. Internally most use a shim like `globalThis.browser?.runtime?.id ? globalThis.browser : globalThis.chrome` (this is literally WXT's implementation) plus per-target output directories.

The 2025 consensus, captured across the comparative-analysis articles, is that **WXT is now the leading framework**, with Plasmo (React-first, but flagged for maintenance lag) and CRXJS (lower-level Vite plugin) as alternatives. Plain `webextension-polyfill` + Vite/Webpack remains a viable minimalist path.

---

## 3. Key Files (what each does, and why it matters)

### 3.1 `manifest.json`

The single source of truth for browser permissions and entry points. The minimum required keys are `manifest_version`, `name`, `version`. Everything else is opt-in.

A cross-browser MV3 manifest typically looks like:

```json
{
  "manifest_version": 3,
  "name": "My Extension",
  "version": "1.0.0",
  "description": "...",

  "permissions": ["storage", "tabs", "scripting", "activeTab"],
  "host_permissions": ["https://*.example.com/*"],

  "action": {
    "default_popup": "popup.html",
    "default_title": "My Extension",
    "default_icons": { "16": "icons/16.png", "48": "icons/48.png", "128": "icons/128.png" }
  },

  "background": {
    "service_worker": "background.js",   // Chrome reads this
    "scripts": ["background.js"],        // Firefox reads this; Chrome ignores it
    "type": "module"                     // optional; both honor for ESM background
  },

  "content_scripts": [{
    "matches": ["https://*.example.com/*"],
    "js": ["content.js"],
    "run_at": "document_idle"
  }],

  "icons": { "16": "icons/16.png", "48": "icons/48.png", "128": "icons/128.png" },

  "browser_specific_settings": {
    "gecko": {
      "id": "my-extension@example.com",
      "strict_min_version": "109.0"
    }
  }
}
```

Critical cross-browser nuances:

- **Dual `background` keys** is the canonical trick for one manifest covering both: Chrome uses `service_worker`, Firefox uses `scripts`, each silently ignores the other.
- **`browser_specific_settings.gecko.id` is REQUIRED for Firefox MV3 publishing.** Without it, AMO rejects the upload. Chrome ignores it.
- **`host_permissions` is split out from `permissions` in MV3.** In MV2 they were a single `permissions` array.
- **Action API unification:** MV3 collapses `browser_action` and `page_action` (MV2) into a single `action` key — both browsers honor this in MV3.
- **CSP is much stricter in MV3** for both browsers: `extension_pages` may only allow `'self'` and `'wasm-unsafe-eval'`; `'unsafe-eval'` and remote `script-src` are forbidden. This is what kills `eval()`-based libraries.

### 3.2 `background.ts`

Where event-driven logic lives. Listens to `runtime.onInstalled`, `runtime.onMessage`, `tabs.onUpdated`, `alarms.onAlarm`, `webRequest.*`, etc.

```ts
import browser from "webextension-polyfill";

browser.runtime.onInstalled.addListener(() => {
  console.log("installed");
});

browser.runtime.onMessage.addListener(async (msg, sender) => {
  if (msg.type === "ping") return { ok: true };
});
```

Hard rule for MV3 cross-browser: **never store state in module-level variables in the background.** On Chrome, the SW will be torn down after ~30 s idle and your variables vanish. Use `browser.storage.session` (in-memory, but persisted across SW restarts) or `browser.storage.local`.

### 3.3 Content script (`content.ts`)

Runs in an isolated world inside the target page. Has DOM access but cannot read page-script variables. Communicates with background via `browser.runtime.sendMessage` / `onMessage`, and with the page-script realm via `window.postMessage` or DOM custom events.

### 3.4 Popup, Options, Side Panel HTML+TS

Plain HTML pages bundled into the extension. They run on `chrome-extension://<id>/...` (or `moz-extension://<uuid>/...`) and have full extension API access. Lifecycle: popup is destroyed on close; treat each open as a fresh mount.

### 3.5 `tsconfig.json`

A typical config:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "WebWorker"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["webextension-polyfill"]
  }
}
```

`"WebWorker"` in `lib` is needed so the service-worker `self`/`ServiceWorkerGlobalScope` types resolve in the background script.

### 3.6 Type-definition packages

| Package | What it gives | When to use |
|---|---|---|
| `@types/webextension-polyfill` | Promise-based `browser.*` types, auto-generated from Mozilla schemas | Cross-browser projects using the polyfill — recommended default |
| `@types/firefox-webext-browser` | Bare `browser.*` global types from Mozilla's schemas | Targeting Firefox primarily; using `browser.*` directly without the polyfill |
| `@types/chrome` | `chrome.*` types, manually maintained, callback-style coverage | Chrome-only extensions, or when you must call Chrome-specific APIs |

The cleanest cross-browser TS setup is `webextension-polyfill` + `@types/webextension-polyfill`, where `import browser from "webextension-polyfill"` resolves both runtime and types.

### 3.7 Build config

For a hand-rolled toolchain you'll typically have one of:

- `vite.config.ts` + `@crxjs/vite-plugin` (CRXJS),
- `wxt.config.ts` (WXT — also Vite-based), or
- `webpack.config.ts` (legacy/Plasmo-style).

Common requirements: copy `manifest.json` to `dist/`, copy static assets (icons, locales, polyfill bundle), produce per-entry bundles (background, content, popup, options) without a shared chunk that the manifest can't load.

### 3.8 `package.json` scripts (typical)

```jsonc
{
  "scripts": {
    "dev:chrome": "wxt",                          // or vite build --watch + load unpacked
    "dev:firefox": "wxt -b firefox",
    "build:chrome": "wxt build",
    "build:firefox": "wxt build -b firefox",
    "zip:firefox": "wxt zip -b firefox",
    "lint:ext": "web-ext lint -s dist/",
    "sign:firefox": "web-ext sign -s dist/ --api-key=$AMO_JWT_ISSUER --api-secret=$AMO_JWT_SECRET"
  }
}
```

---

## 4. Data Flow

### 4.1 Lifecycle (install → run → terminate)

1. **User installs** extension (from store .zip or unpacked dir during dev).
2. **Browser parses `manifest.json`.** Validates permissions; on Chrome the `service_worker` is registered; on Firefox the event-page `scripts` are loaded into a hidden background context.
3. **`runtime.onInstalled` fires.** First-time setup goes here (default settings into `browser.storage.local`, context-menus, alarms).
4. **User navigates.** For every URL matching `content_scripts.matches`, the browser injects the content script(s) at `run_at` (`document_start` / `document_end` / `document_idle`).
5. **User clicks toolbar icon.** Popup HTML is rendered. Popup script runs. `activeTab` permission, if requested, briefly grants host permissions for the active tab without a permission prompt.
6. **Idle.** On Chrome, SW gets torn down after ~30 s; in-memory state is GC'd. On Firefox, the event page is also unloaded but with slightly different timing.
7. **An event fires** (alarm, message, webRequest hook, etc.) → SW/event page is re-spun-up → registered listeners are re-invoked. **Listeners must be registered synchronously at the top level of the script** so they exist on every wake; registering inside `await` chains causes silent missed events.

### 4.2 Message passing

The most common data path is content-script ↔ background ↔ popup, all over `runtime.sendMessage` / `tabs.sendMessage`.

```
[ Page DOM ]  ←postMessage→  [ Content Script ]
                                    │
                                    │ browser.runtime.sendMessage({...})
                                    ▼
                          [ Background / Service Worker ]
                                    │  (stores in browser.storage.local)
                                    │  browser.tabs.sendMessage(tabId, ...)
                                    ▼
                              [ Other tab's content script ]
                                    │
                                    │  (popup also pulls via runtime.sendMessage)
                                    ▼
                              [ Popup / Options ]
```

Receivers (`runtime.onMessage.addListener`) can either:
- Call `sendResponse(...)` synchronously and return `true` to keep the channel open (Chrome legacy callback style), or
- Return a `Promise` directly (Firefox-native and modern Chrome under the polyfill — recommended for cross-browser).

For high-throughput / streaming, use `runtime.connect` → `Port` instead of one-shot messages.

### 4.3 Storage

Three storage areas are exposed; semantics agree across browsers:

- **`storage.local`** — per-extension, on-disk, ~10 MB default (Chrome 113+; 5 MB before). Wiped on uninstall. Use for app state, caches, settings.
- **`storage.sync`** — same shape but synced to the user's browser-account profile (Google account on Chrome, Firefox account on Firefox). Hard quotas: ~100 KB total, 8 KB per item, throttled writes. Use only for tiny user prefs.
- **`storage.session`** — in-memory, cleared on browser restart. ~10 MB (Chrome 112+; 1 MB before). The natural place for SW-recoverable transient state. **Cross-browser caveat:** on Chrome, `storage.session` is by default only readable from the SW; if the popup or a content script needs it, the SW must call `chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' })`.

All three return Promises under `webextension-polyfill` and emit `storage.onChanged` on writes.

### 4.4 Programmatic injection (`scripting` API)

MV3 retired `tabs.executeScript`. The replacement, `scripting.executeScript`, is in both `chrome.scripting` (Chrome 88+) and `browser.scripting` (Firefox 102+ MV2; 101+ MV3; Safari recent). It requires the `"scripting"` permission and host permissions for the target. Cross-browser shape:

```ts
await browser.scripting.executeScript({
  target: { tabId },
  func: () => document.title,
  // OR: files: ["injected.js"]
});
```

Constraints: `func` must be self-contained (no closure over outer-scope vars — they aren't serialized across realms). Chrome supports a `world: "MAIN" | "ISOLATED"` option; Firefox lags on `MAIN`.

---

## 5. Dependencies

A representative cross-browser TS extension's `package.json` will include some subset of:

### 5.1 Runtime / API

- **`webextension-polyfill`** — Mozilla's UMD polyfill. ~14 KB minified. No-op on Firefox. Required if you write `browser.*` and want it to work on Chrome.

### 5.2 Types

- **`@types/webextension-polyfill`** — formerly `webextension-polyfill-ts`; recommended for cross-browser.
- **`@types/firefox-webext-browser`** — alternative if you skip the polyfill and rely on browsers' native `browser` global (Firefox + late-Chrome).
- **`@types/chrome`** — supplementary if you call Chrome-specific APIs.

### 5.3 Frameworks (pick at most one)

- **`wxt`** — recommended in 2025. Vite-based, file-system entrypoints, auto manifest, multi-browser builds, HMR for content scripts, modules system, framework-agnostic (React/Vue/Svelte/vanilla), publishes via built-in `wxt submit`.
- **`plasmo`** — React-first, opinionated, Parcel-based; abstracts manifest entirely; `getManifest`-style overrides. Concerns about maintenance velocity in 2025.
- **`@crxjs/vite-plugin`** — lower-level Vite plugin. Excellent content-script HMR. You still write `manifest.json` (or `manifest.ts`).
- **`extension.js`** — newer Rspack-based "zero-config" framework with built-in browser-specific manifest fields.

### 5.4 Build & dev tooling

- **`web-ext`** (Mozilla CLI) — `web-ext run` to launch a Firefox instance with the extension auto-loaded, `web-ext lint` for manifest validation, `web-ext build` to produce a .zip, `web-ext sign` to publish to AMO.
- **`vite` / `webpack` / `rollup` / `rspack`** — JS bundling.
- **`typescript`** — obviously.
- **`@types/node`**, **`tsx`** / `ts-node` — for running build scripts.
- **`copy-webpack-plugin`** (Webpack) — common pattern: copy `node_modules/webextension-polyfill/dist/browser-polyfill.js` into the extension output so it can be referenced from the manifest.

### 5.5 Optional UI

Any DOM framework works in the popup/options/sidepanel: React, Vue, Svelte, Solid, Preact, vanilla. Tailwind, CSS Modules, etc. all work.

---

## 6. Edge Cases (the long tail of cross-browser gotchas)

### 6.1 Background context shape

- **Firefox does not have service workers for extensions** as of 2025. It runs MV3 `background.scripts` as **non-persistent event pages** that *do* have `window`/`document`. Code that imports a DOM library will work in Firefox and crash in Chrome's SW. The portable rule: write background code as if it were a service worker (no DOM, `fetch` only, no `XMLHttpRequest`, no `localStorage`).
- **Service worker termination is observable.** On Chrome, ~30 s idle → terminate. Module-level state vanishes. Re-registration of listeners must happen synchronously on every load (not after `await`).
- **`importScripts()`** works in MV3 service workers but only inside the SW; ESM imports work if `"background": { "service_worker": "...", "type": "module" }`. Firefox event pages support ESM via `<script type="module">`-equivalent semantics in `scripts`.

### 6.2 API namespace edge cases

- On Chrome with `webextension-polyfill` loaded as a module, `import browser from "webextension-polyfill"` is the canonical import. Loading via `<script src="browser-polyfill.js">` exposes `browser` globally — but doing both will not cause a conflict because the polyfill detects an existing `browser`.
- On Firefox, `webextension-polyfill` is a **strict no-op**: `browser.*` is the native global, and the polyfill detects this and exits early. Bundle size is tiny but non-zero.
- The `chrome.*` global is also exposed on Firefox in some versions for Chrome-extension compat — but it is *not* a complete mirror. Don't rely on it.

### 6.3 Promise/callback hybrid bugs

- Chrome MV3 APIs return Promises *most* of the time, but a few legacy methods still demand callbacks. The polyfill normalizes the documented MV3 surface only — anything outside its `api-metadata.json` won't be wrapped.
- `runtime.onMessage` listeners: the polyfill normalizes "return a Promise" to work on Chrome (Chrome's native API expects `return true` + `sendResponse`). Mixing the two patterns in the same listener causes the channel to close early.

### 6.4 Manifest V3 pitfalls

- **Firefox 126 and earlier did not grant MV3 host permissions at install.** They were optional; the user had to flip a toggle. Firefox 127+ grants at install like Chrome. Test the install flow on both LTS and current.
- **CSP `'unsafe-eval'` is forbidden.** Libraries that use `eval` or `new Function` (some templating engines, some serializers) will crash silently in production. Lodash `_.template`, older Vue templates with runtime compilation, etc.
- **Remote code is forbidden.** No `<script src="https://cdn...">`. All code must be bundled. Stores reject extensions that violate this.
- **`tabs.executeScript` is gone in MV3** → use `scripting.executeScript`. Watch for stale tutorials.
- **Downloads from content scripts via background were silently broken** in early MV3 for some flows; route through `chrome.downloads` from the SW with proper permissions.

### 6.5 Content-script realm pitfalls

- Default isolated world means `window.someLib` set by the page is invisible to the content script and vice-versa. To bridge: inject a script into the MAIN world (`scripting.executeScript({ world: "MAIN" })` on Chrome; for Firefox use `<script>`-injection trick from the content script) and exchange data via `window.postMessage` + `MessageEvent`.
- Firefox provides `window.wrappedJSObject` and `cloneInto()`/`exportFunction()` for cross-realm cloning — these are Firefox-only and won't compile-fail but will be `undefined` on Chrome.
- ESM in content scripts is essentially unsupported across browsers in 2025: `manifest.json` content_scripts entries can only list flat JS files. Workarounds use dynamic `import()` of an extension URL, but `run_at` becomes meaningless because the load is async.

### 6.6 Storage area gotchas

- `storage.sync` is throttled (typical: ~120 writes/min). A naive `for-each setItem` loop trips the limit and fails silently with a quota error.
- `storage.session` access from non-SW contexts on Chrome requires a SW-side `setAccessLevel` call — not symmetric with Firefox where event-page-scoped contexts can read it directly.
- All three storage areas serialize via structured-clone — Maps and Sets survive on Firefox but not always on older Chrome; functions, `undefined`, DOM nodes are silently dropped on both. Always JSON-roundtrip-ish data only.

### 6.7 Signing & store rules

- **Firefox AMO signing** requires JWT API key + secret; `web-ext sign --channel=listed|unlisted` handles both AMO-listed and self-distributed paths. Self-distributed Firefox add-ons must still be signed by Mozilla, just not listed publicly. Unsigned add-ons run only in Firefox Developer Edition / Nightly.
- **Chrome Web Store** requires a $5 one-time fee, automated pre-review (~1 hour to a few hours), then publication. Manifest-V2 submissions are no longer accepted (MV2 was disabled in 2024–2025).
- **Edge Add-ons** is free, manual review, no SLA.
- **Safari** requires Xcode 14+ converting the .zip via `xcrun safari-web-extension-converter`, $99/yr Apple developer membership, App Store review (~24–48 h).

### 6.8 i18n

`_locales/<lang>/messages.json` + `__MSG_key__` substitutions in `manifest.json` and `browser.i18n.getMessage("key")` at runtime. Both browsers handle this consistently — but file paths are case-sensitive on Linux (`en` vs `en_US`) so test on the OS your CI uses.

### 6.9 Self-hosted update channel (Firefox unlisted)

`browser_specific_settings.gecko.update_url` lets a self-distributed Firefox extension specify an update manifest. Chrome equivalent is `update_url` at the manifest top level for self-hosted CRX. Both require still-signed builds.

### 6.10 Permissions UX divergence

Asking for `<all_urls>` in `host_permissions` triggers a strong "this extension can read all your browsing" warning at install on both browsers — but the wording and consequences differ. Firefox 127+ now gates per-host post-install; Chrome offers per-site activation via the toolbar puzzle icon. Users will toggle these. Always feature-detect with `permissions.contains({ origins: [...] })` and request via `permissions.request(...)` from a user-gesture handler.

---

## 7. Potential Issues Discovered

These are the issues a developer is most likely to hit in 2026 when building from scratch. None are blockers, but each is a real-world snag worth pre-mitigating.

1. **Single-manifest with dual `background` keys is the de-facto pattern but is technically fragile.** Both browsers ignore the key they don't use today, but neither *guarantees* this. If Chrome's MV3 schema validator becomes stricter, the `scripts` key could become an error. Frameworks like WXT sidestep this by emitting **per-browser** manifests into separate `dist-chrome/` and `dist-firefox/` folders. Recommended: per-target builds, not a single manifest.

2. **Service-worker termination breaks naive state-machines.** This is the #1 reported MV3 migration pitfall. Any closure that depends on module-level state will mysteriously stop working after 30 s of idle. The fix — persist everything to `storage.session` — needs to be designed in from day one, not bolted on later.

3. **`webextension-polyfill` doesn't cover MV3-only APIs that postdate the polyfill's `api-metadata.json`.** Issue #329 in mozilla/webextension-polyfill explicitly tracks Manifest V3 API gaps. For new MV3 surfaces (`sidePanel`, `declarativeNetRequest`, `userScripts` on MV3, `offscreen`), the polyfill may pass through to `chrome.*` without wrapping, and TS types will be incomplete. Workaround: feature-detect, fall back to `chrome.*` with `// @ts-expect-error`.

4. **`@types/chrome` and `@types/webextension-polyfill` overlap and can fight.** If both are in `tsconfig.compilerOptions.types`, duplicate `browser`/`chrome` global declarations confuse `tsc`. Pick one and stick to it.

5. **Hot-reload in dev for content scripts is fundamentally hard.** Chrome's CSP + isolated worlds make HMR a build-tool wrestling match. WXT and CRXJS solve this best in 2025; rolling your own with Vite/Webpack tends to require a full extension reload on every save, which is slow.

6. **Firefox's lack of service workers is a permanent cross-browser tax.** Anything that uses `self.clients`, `caches`, `ServiceWorkerRegistration`, or `PushManager` from inside the background will work on Chrome and break on Firefox. The portable subset is small: `fetch`, `crypto.subtle`, `setTimeout/Interval` (kept alive only while the SW is alive), the WebExtensions API itself.

7. **MV3 CSP forbids `'unsafe-eval'`.** Many TS-compiled libraries are fine, but check that your bundler isn't emitting `eval`-based source-maps in production (`devtool: 'eval'` family in Webpack), and that no transitive dependency uses runtime `Function()` constructors. Both stores reject extensions whose CSP loosens this.

8. **Firefox AMO signing is mandatory even for self-distribution.** This is often a surprise for teams coming from Chrome. Unsigned `.xpi` files won't load in stable/beta Firefox, only Developer Edition / Nightly with `xpinstall.signatures.required = false`. Plan AMO API credentials into CI early.

9. **`browser_specific_settings.gecko.id` is required for MV3 on AMO.** Forgetting it produces a confusing AMO upload error rather than a clear schema message.

10. **Chrome's MV2 is end-of-life.** As of 2024–2025, Chrome stopped accepting MV2 submissions and is force-disabling MV2 extensions. For new projects, MV3-only is the only sane target; do **not** spend effort on MV2 fallback unless you have an existing MV2 codebase.

11. **The choice of `browser.*` vs `chrome.*` API style leaks into TypeScript ergonomics.** Mixing both styles in one codebase produces type-narrow errors that are hard to read. Pick one (recommended: `browser.*` via the polyfill) and forbid the other with an ESLint rule.

12. **Manifest schema differences are not formally typed.** `manifest.json` is plain JSON — there's no canonical TS type for it that covers both Chrome and Firefox MV3 dialects. WXT and Plasmo define their own internal types; if you hand-write the manifest you're on your own. JSON Schema validators (`web-ext lint`, Chrome's CWS upload check) catch most issues at build time.

13. **Empty project here.** The actual repo `/Users/tai2/star-hater` has no source yet, so this report is purely doctrinal. Any concrete framework decision (WXT vs. CRXJS vs. plain polyfill) will redirect a substantial amount of the rest of the architecture (manifest authoring, build scripts, dev workflow). No further code-tracing was possible.

---

## 8. Summary cheat-sheet (for quick reference)

- **Default stack to recommend in 2026:** WXT + TypeScript + chosen UI framework. Falls back gracefully to plain `webextension-polyfill` + Vite if you want zero framework lock-in.
- **Always:** target MV3 only; use Promise-style `browser.*`; persist all background state to `storage.local`/`storage.session`; register listeners synchronously at top level; provide `browser_specific_settings.gecko.id` for Firefox.
- **Never:** rely on module-level state surviving in the background; use `eval` or remote code; mix `chrome.*` and `browser.*` styles in the same file; assume one manifest works for both browsers without testing both.
- **Test matrix minimum:** Chrome stable, Chrome beta, Firefox ESR, Firefox stable. CI: `web-ext lint` + `tsc --noEmit` + a smoke-test that loads the unpacked extension into a headless browser (Playwright supports this).

---

## Sources

- MDN — [Build a cross-browser extension](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Build_a_cross_browser_extension)
- MDN — [Browser Extensions overview](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions)
- Mozilla — [`webextension-polyfill` repository](https://github.com/mozilla/webextension-polyfill)
- npm — [`@types/webextension-polyfill`](https://www.npmjs.com/package/@types/webextension-polyfill)
- WXT — [Official site & docs](https://wxt.dev/) and [Extension APIs guide](https://wxt.dev/guide/essentials/extension-apis)
- Plasmo — [Documentation](https://docs.plasmo.com/)
- Extension.js — [What is a browser extension](https://extension.js.org/docs/concepts/what-is-a-browser-extension)
- redreamality — [The 2025 State of Browser Extension Frameworks (Plasmo / WXT / CRXJS)](https://redreamality.com/blog/the-2025-state-of-browser-extension-frameworks-a-comparative-analysis-of-plasmo-wxt-and-crxjs/)
- Firefox Extension Workshop — [Manifest V3 migration guide](https://extensionworkshop.com/documentation/develop/manifest-v3-migration-guide/)
- Firefox Extension Workshop — [Getting started with web-ext](https://extensionworkshop.com/documentation/develop/getting-started-with-web-ext/)
- Chrome for Developers — [`chrome.scripting`](https://developer.chrome.com/docs/extensions/reference/api/scripting), [Migrate to a service worker](https://developer.chrome.com/docs/extensions/develop/migrate/to-service-workers), [Message passing](https://developer.chrome.com/docs/extensions/develop/concepts/messaging), [Declare permissions](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions), [Storage API](https://developer.chrome.com/docs/extensions/reference/api/storage)
- MDN — [`scripting.executeScript`](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/scripting/executeScript), [`runtime.sendMessage`](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/runtime/sendMessage), [`runtime.onMessage`](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/runtime/onMessage), [`storage`](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/storage)
- orta — [`typescript-web-extension` template](https://github.com/orta/typescript-web-extension)
- Lusito — [`webextension-polyfill-ts`](https://github.com/Lusito/webextension-polyfill-ts) (now superseded by `@types/webextension-polyfill`)
- DEV Community — [Manifest V3 Migration Pitfalls — Lessons from 17 Chrome Extensions](https://dev.to/_350df62777eb55e1/manifest-v3-migration-pitfalls-lessons-from-17-chrome-extensions-2j3h)
- codestudy.net — [Manifest v3 Background Scripts vs Service Workers in Firefox](https://www.codestudy.net/blog/manifest-v3-background-scripts-service-worker-on-firefox/)
- stefanvd.net — [Firefox Manifest V3 Extension - A Developer's Perspective](https://www.stefanvd.net/blog/2023/11/30/firefox-manifest-v3-extension-a-developer-perspective/)
