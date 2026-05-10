import { defineConfig } from "wxt";

const PRESET_HOSTS = [
  "https://github.com/*",
  "https://gitlab.com/*",
  "https://x.com/*",
  "https://twitter.com/*",
];

export default defineConfig({
  modules: ["@wxt-dev/module-react"],

  manifestVersion: 3,

  manifest: ({ browser }) => ({
    name: "StarHater",
    description:
      "Hide star counts, like counts, and other bias-inducing engagement signals on the web.",

    permissions: ["storage", "scripting"],
    host_permissions: PRESET_HOSTS,
    optional_host_permissions: ["*://*/*"],

    ...(browser === "firefox"
      ? {
          browser_specific_settings: {
            gecko: {
              id: "star-hater@tai2.net",
            },
          },
        }
      : {}),
  }),
});
