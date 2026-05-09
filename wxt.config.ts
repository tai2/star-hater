import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],

  manifestVersion: 3,

  manifest: ({ browser }) => ({
    name: "star-hater",
    description: "Hide starred items from feeds.",

    permissions: ["storage"],

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
