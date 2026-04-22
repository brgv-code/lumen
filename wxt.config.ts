import { defineConfig } from "wxt";

export default defineConfig({
  srcDir: "extension",
  extensionApi: "chrome",
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "Lumen",
    description: "Fully local reading assistant",
    version: "1.0.0",
    permissions: ["storage", "activeTab"],
    host_permissions: ["<all_urls>"],
    action: {
      default_popup: "popup.html",
      default_icon: {
        "16": "icons/icon16.png",
        "32": "icons/icon32.png",
        "48": "icons/icon48.png",
        "128": "icons/icon128.png",
      },
    },
    options_ui: {
      page: "options.html",
      open_in_tab: true,
    },
    icons: {
      "16": "icons/icon16.png",
      "32": "icons/icon32.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png",
    },
  },
});
