// Default-disabled placeholder. Narrow `matches` to specific hosts before
// enabling — <all_urls> triggers a strong install-time warning on both browsers.
export default defineContentScript({
  matches: ["https://example.com/*"],
  main() {
    console.log("[star-hater] content script alive");
  },
});
