export async function broadcastRulesUpdated(): Promise<void> {
  const tabs = await browser.tabs.query({});
  await Promise.all(
    tabs.map((t) =>
      t.id != null
        ? browser.tabs
            .sendMessage(t.id, { type: "RULES_UPDATED" })
            .catch(() => undefined)
        : undefined,
    ),
  );
}
