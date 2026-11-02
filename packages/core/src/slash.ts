// Slash commands typed into Ask boxes (LUM-3).

export const SLASH_COMMANDS = ["tldr", "define", "counter", "related"] as const;
export type SlashCommand = (typeof SLASH_COMMANDS)[number];

/** Shown under an Ask box while the reader is typing a command. */
export const SLASH_HINT = "/tldr the page · /define a term · /counter the passage · /related in your library";

function isSlashCommand(value: string | undefined): value is SlashCommand {
  return (SLASH_COMMANDS as readonly unknown[]).includes(value);
}

/** "/define latency" is { command: "define", rest: "latency" }; anything else is a normal question. */
export function parseSlash(input: string): { command: SlashCommand; rest: string } | null {
  const match = /^\/(\w+)(?:\s+([\s\S]*))?$/.exec(input.trim());
  const command = match?.[1]?.toLowerCase();
  if (!match || !isSlashCommand(command)) return null;
  return { command, rest: (match[2] ?? "").trim() };
}
