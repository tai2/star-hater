import { runRuleEngine } from "@/src/rules/engine";

export default defineContentScript({
  matches: [
    "https://github.com/*",
    "https://gitlab.com/*",
    "https://x.com/*",
    "https://twitter.com/*",
  ],
  runAt: "document_start",
  async main(ctx) {
    await runRuleEngine(ctx);
  },
});
