import { getEffectiveRules } from "./store";
import { PRESETS } from "./presets";

const STATIC_HOSTS = new Set(PRESETS.map((p) => p.urlPattern));
const SCRIPT_ID = "starhater-user";

export async function syncDynamicContentScripts(): Promise<void> {
  const effective = await getEffectiveRules();
  const userPatterns = Array.from(
    new Set(
      effective
        .filter((r) => r.source === "user" && r.enabled)
        .map((r) => r.urlPattern),
    ),
  ).filter((p) => !STATIC_HOSTS.has(p));

  try {
    await browser.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] });
  } catch {
    /* not registered yet */
  }

  if (userPatterns.length === 0) return;

  const granted: string[] = [];
  for (const p of userPatterns) {
    if (await browser.permissions.contains({ origins: [p] })) granted.push(p);
  }
  if (granted.length === 0) return;

  await browser.scripting.registerContentScripts([
    {
      id: SCRIPT_ID,
      matches: granted,
      js: ["content-scripts/content.js"],
      runAt: "document_start",
      allFrames: false,
    },
  ]);
}
