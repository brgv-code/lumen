import { defineConfig } from "wxt";

export default defineConfig({
  srcDir: "src",
  extensionApi: "chrome",
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "Lumen",
    description: "Highlight, ask and send what you read to Obsidian, Notion or markdown.",
    version: "2.0.0",
    permissions: ["storage", "activeTab", "contextMenus", "nativeMessaging"],
    host_permissions: ["<all_urls>"],
    action: {
      default_popup: "popup.html",
      default_icon: { "16": "icons/icon16.png", "32": "icons/icon32.png", "48": "icons/icon48.png", "128": "icons/icon128.png" },
    },
    options_ui: { page: "options.html", open_in_tab: true },
    icons: { "16": "icons/icon16.png", "32": "icons/icon32.png", "48": "icons/icon48.png", "128": "icons/icon128.png" },
    commands: {
      "highlight-selection": { suggested_key: { default: "Alt+Shift+H" }, description: "Highlight the selection" },
      "save-page": { suggested_key: { default: "Alt+Shift+S" }, description: "Save this page to Lumen" },
    },
  },
});
