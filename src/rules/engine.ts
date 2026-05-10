import type { ContentScriptContext } from "wxt/utils/content-script-context";
import { getEffectiveRules } from "./store";
import { matchPattern } from "./match";
import type { Rule } from "./types";

const STYLE_ID = "starhater-style";

export async function runRuleEngine(ctx: ContentScriptContext): Promise<void> {
  await applyRulesForCurrentUrl();

  const stop1 = storage.watch("sync:userRules", () => {
    void applyRulesForCurrentUrl();
  });
  const stop2 = storage.watch("sync:presetOverrides", () => {
    void applyRulesForCurrentUrl();
  });

  installUrlChangeWatcher(ctx, () => {
    void applyRulesForCurrentUrl();
  });

  ctx.signal.addEventListener("abort", () => {
    stop1();
    stop2();
    document.getElementById(STYLE_ID)?.remove();
  });
}

async function applyRulesForCurrentUrl(): Promise<void> {
  const rules = await getEffectiveRules();
  const active = rules.filter(
    (r) => r.enabled && matchPattern(r.urlPattern, location.href),
  );
  injectStyle(active);
}

function injectStyle(rules: Rule[]): void {
  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement("style");
    el.id = STYLE_ID;
    (document.head ?? document.documentElement).appendChild(el);
  }
  if (rules.length === 0) {
    el.textContent = "";
    return;
  }
  el.textContent = `${rules.map((r) => r.selector).join(", ")} { visibility: hidden !important; }`;
}

function installUrlChangeWatcher(
  ctx: ContentScriptContext,
  onChange: () => void,
): void {
  let last = location.href;
  const tick = () => {
    if (location.href !== last) {
      last = location.href;
      onChange();
    }
  };
  for (const fn of ["pushState", "replaceState"] as const) {
    const orig = history[fn];
    history[fn] = function (this: History, ...args: Parameters<typeof orig>) {
      const ret = orig.apply(this, args);
      queueMicrotask(tick);
      return ret;
    } as typeof orig;
  }
  window.addEventListener("popstate", tick, { signal: ctx.signal });
  window.addEventListener("hashchange", tick, { signal: ctx.signal });
}
