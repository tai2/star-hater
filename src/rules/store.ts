import { PRESETS } from "./presets";
import type { Rule, RuleId } from "./types";

const USER_RULES_KEY = "sync:userRules" as const;
const OVERRIDES_KEY = "sync:presetOverrides" as const;

export async function getEffectiveRules(): Promise<Rule[]> {
  const [userRules, overrides] = await Promise.all([
    storage.getItem<Rule[]>(USER_RULES_KEY),
    storage.getItem<Record<RuleId, { enabled: boolean }>>(OVERRIDES_KEY),
  ]);
  const ovr = overrides ?? {};
  const presetsResolved = PRESETS.map((p) => {
    const override = ovr[p.id];
    return override ? { ...p, enabled: override.enabled } : p;
  });
  return [...presetsResolved, ...(userRules ?? [])];
}

export async function setPresetEnabled(
  id: RuleId,
  enabled: boolean,
): Promise<void> {
  const ovr =
    (await storage.getItem<Record<RuleId, { enabled: boolean }>>(
      OVERRIDES_KEY,
    )) ?? {};
  ovr[id] = { enabled };
  await storage.setItem(OVERRIDES_KEY, ovr);
}

export async function addUserRule(
  rule: Omit<Rule, "id" | "source">,
): Promise<Rule> {
  const r: Rule = {
    ...rule,
    id: `user.${crypto.randomUUID()}`,
    source: "user",
  };
  const list = (await storage.getItem<Rule[]>(USER_RULES_KEY)) ?? [];
  await storage.setItem(USER_RULES_KEY, [...list, r]);
  return r;
}

export async function removeUserRule(id: RuleId): Promise<void> {
  const list = (await storage.getItem<Rule[]>(USER_RULES_KEY)) ?? [];
  await storage.setItem(
    USER_RULES_KEY,
    list.filter((r) => r.id !== id),
  );
}

export async function setUserRuleEnabled(
  id: RuleId,
  enabled: boolean,
): Promise<void> {
  const list = (await storage.getItem<Rule[]>(USER_RULES_KEY)) ?? [];
  await storage.setItem(
    USER_RULES_KEY,
    list.map((r) => (r.id === id ? { ...r, enabled } : r)),
  );
}
