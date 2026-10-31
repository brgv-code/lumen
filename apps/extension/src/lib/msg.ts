import type { Msg } from "./types";
export const send = <T = any>(m: Msg) => chrome.runtime.sendMessage(m) as Promise<T>;
