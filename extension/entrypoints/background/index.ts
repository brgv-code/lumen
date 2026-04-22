import { streamAIResponse, testConnection } from "../../lib/ai";
import {
  getItems,
  saveItem,
  deleteItem,
  clearAllItems,
  getSettings,
  saveSettings,
} from "../../lib/storage";
import type { MessageType } from "../../lib/types";

export default defineBackground(() => {
  chrome.runtime.onMessage.addListener(
    (message: MessageType, sender, sendResponse) => {
      handleMessage(message, sender, sendResponse);
      return true;
    },
  );
});

async function handleMessage(
  message: MessageType,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: unknown) => void,
) {
  const tabId = sender.tab?.id;

  switch (message.type) {
    case "AI_REQUEST": {
      const settings = await getSettings();
      await streamAIResponse(
        message.text,
        message.action,
        settings,
        (chunk) => {
          if (tabId !== undefined) {
            chrome.tabs.sendMessage(tabId, {
              type: "AI_STREAM_CHUNK",
              chunk,
              done: false,
            });
          }
        },
        () => {
          if (tabId !== undefined) {
            chrome.tabs.sendMessage(tabId, {
              type: "AI_STREAM_CHUNK",
              chunk: "",
              done: true,
            });
          }
        },
        (error) => {
          if (tabId !== undefined) {
            chrome.tabs.sendMessage(tabId, {
              type: "AI_STREAM_ERROR",
              error,
            });
          }
        },
      );
      sendResponse({ ok: true });
      break;
    }

    case "SAVE_ITEM": {
      const saved = await saveItem(message.item);
      sendResponse({ ok: true, item: saved });
      break;
    }

    case "DELETE_ITEM": {
      await deleteItem(message.id);
      sendResponse({ ok: true });
      break;
    }

    case "CLEAR_ALL": {
      await clearAllItems();
      sendResponse({ ok: true });
      break;
    }

    case "GET_ITEMS": {
      const items = await getItems();
      sendResponse({ ok: true, items });
      break;
    }

    case "GET_SETTINGS": {
      const settings = await getSettings();
      sendResponse({ ok: true, settings });
      break;
    }

    case "SAVE_SETTINGS": {
      await saveSettings(message.settings);
      sendResponse({ ok: true });
      break;
    }

    case "TEST_CONNECTION": {
      const settings = await getSettings();
      const result = await testConnection(settings);
      sendResponse(result);
      break;
    }

    default:
      sendResponse({ ok: false, error: "Unknown message type" });
  }
}
