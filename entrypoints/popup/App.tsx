import { useEffect, useState, useCallback } from "react";
import {
  getEffectiveRules,
  setPresetEnabled,
  addUserRule,
  removeUserRule,
  setUserRuleEnabled,
} from "@/src/rules/store";
import type { Rule } from "@/src/rules/types";

export default function App() {
  const [rules, setRules] = useState<Rule[] | null>(null);
  const reload = useCallback(() => {
    void getEffectiveRules().then(setRules);
  }, []);

  useEffect(() => {
    reload();
    const unsub1 = storage.watch("sync:userRules", reload);
    const unsub2 = storage.watch("sync:presetOverrides", reload);
    return () => {
      unsub1();
      unsub2();
    };
  }, [reload]);

  if (!rules) return <main>Loading…</main>;

  return (
    <main>
      <h1>StarHater</h1>
      <section>
        <h2>Presets</h2>
        <ul>
          {rules
            .filter((r) => r.source === "preset")
            .map((r) => (
              <li key={r.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={r.enabled}
                    onChange={(e) =>
                      void setPresetEnabled(r.id, e.target.checked)
                    }
                  />
                  {r.label}
                </label>
              </li>
            ))}
        </ul>
      </section>
      <section>
        <h2>Your rules</h2>
        <ul>
          {rules
            .filter((r) => r.source === "user")
            .map((r) => (
              <li key={r.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={r.enabled}
                    onChange={(e) =>
                      void setUserRuleEnabled(r.id, e.target.checked)
                    }
                  />
                  <strong>{r.label}</strong>{" "}
                  <code>{r.urlPattern}</code>{" "}
                  <code>{r.selector}</code>
                </label>
                <button onClick={() => void removeUserRule(r.id)}>
                  Delete
                </button>
              </li>
            ))}
        </ul>
        <AddRuleForm onAdd={reload} />
      </section>
    </main>
  );
}

function AddRuleForm({ onAdd }: { onAdd: () => void }) {
  const [label, setLabel] = useState("");
  const [urlPattern, setUrlPattern] = useState("");
  const [selector, setSelector] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label || !urlPattern || !selector) return;

    const granted = await browser.permissions.request({
      origins: [urlPattern],
    });
    if (!granted) return;

    await addUserRule({ label, urlPattern, selector, enabled: true });
    await browser.runtime.sendMessage({ type: "REGISTER_USER_HOST" });

    setLabel("");
    setUrlPattern("");
    setSelector("");
    onAdd();
  };

  return (
    <form onSubmit={submit}>
      <input
        placeholder="Label"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
      />
      <input
        placeholder="URL pattern (https://example.com/*)"
        value={urlPattern}
        onChange={(e) => setUrlPattern(e.target.value)}
      />
      <input
        placeholder="CSS selector"
        value={selector}
        onChange={(e) => setSelector(e.target.value)}
      />
      <button type="submit">Add rule</button>
    </form>
  );
}
