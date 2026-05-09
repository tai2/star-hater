// Emitted as background.service_worker on Chrome MV3 and background.scripts
// (event page) on Firefox MV3. Treat as a service worker on both: do not store
// state in module-level variables (use browser.storage.session) and register
// listeners synchronously at the top level so they survive SW restart.
export default defineBackground(() => {
  browser.runtime.onInstalled.addListener((details) => {
    console.log("[star-hater] installed", details.reason);
  });
});
