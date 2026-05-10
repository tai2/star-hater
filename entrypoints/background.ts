import { broadcastRulesUpdated } from "@/src/rules/messaging-bg";
import { syncDynamicContentScripts } from "@/src/rules/dynamic-scripts";

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(async (details) => {
    console.log("[star-hater] installed", details.reason);
    if (details.reason === "install") {
      await storage.setItem("sync:presetOverrides", {});
      await storage.setItem("sync:userRules", []);
    }
    await syncDynamicContentScripts();
  });

  storage.watch("sync:userRules", () => {
    void syncDynamicContentScripts();
    void broadcastRulesUpdated();
  });
  storage.watch("sync:presetOverrides", () => {
    void broadcastRulesUpdated();
  });

  browser.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "REGISTER_USER_HOST") {
      return syncDynamicContentScripts();
    }
    return undefined;
  });
});
