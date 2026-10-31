import { defineConfig } from "wxt";

export default defineConfig({
  srcDir: "src",
  extensionApi: "chrome",
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "Lumen",
    description: "Highlight, ask and send what you read to Obsidian, Notion or markdown.",
    version: "2.3.1",
    // Fixed public key so the extension id stays ffjconacpmnbadoeegamifkellcddfja when loaded unpacked,
    // which lets the dashboard connect to it with one click (externally_connectable).
    key: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAjfebb4JAs0K8ouxFm4bwltGuYlOvYdZ/uVfmW3uHrhARynIWqjmQ7TrsM0+7gWuBM1IPSK2+GpG+R6ylCDkpMwIhcHR6HLBbO7e5dZ2cxE80OEPO3vP3MaFWa2uEb47zILzXPveoah9rE4W21HaediTDzS6aGG4oFbC0k0nLHPRvcPNyrA6FCbBAfqU4fxB5cGDxgvJ7Kf+pNex2kTcjysAevUju5JfSF2s/A72GD40bH1ZvWbXir98kSnIFFfOG8JQJOH3XfCagIldqT2xwuoqiy8uQI62YoOTxoHw7yo7HCs1Jd3iirirlu+C9KU+G2wXCieNvfsovr4baG+yn6wIDAQAB",
    externally_connectable: {
      matches: ["https://lumen.brgv95.workers.dev/*", "http://localhost:8787/*", "http://localhost:5173/*"],
    },
    permissions: ["storage", "activeTab", "contextMenus", "nativeMessaging", "alarms", "notifications", "sidePanel", "tabs", "scripting"],
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
      "open-panel": { suggested_key: { default: "Alt+Shift+L" }, description: "Open the Lumen panel" },
    },
  },
});
