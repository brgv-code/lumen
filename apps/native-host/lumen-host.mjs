#!/usr/bin/env node
// Lumen native messaging helper. Chrome starts this process when the extension
// asks for Claude; it runs `claude -p` and streams stdout back as messages.
// Protocol: 4 byte little endian length + UTF-8 JSON, both directions.
import { spawn } from "node:child_process";

const ALLOWED_MODELS = new Set(["haiku", "sonnet", "opus"]);

function write(obj) {
  const buf = Buffer.from(JSON.stringify(obj), "utf8");
  const len = Buffer.alloc(4);
  len.writeUInt32LE(buf.length, 0);
  process.stdout.write(Buffer.concat([len, buf]));
}

let pending = Buffer.alloc(0);
process.stdin.on("data", (chunk) => {
  pending = Buffer.concat([pending, chunk]);
  while (pending.length >= 4) {
    const n = pending.readUInt32LE(0);
    if (pending.length < 4 + n) break;
    const body = pending.subarray(4, 4 + n).toString("utf8");
    pending = pending.subarray(4 + n);
    try { handle(JSON.parse(body)); } catch (e) { write({ error: `Bad message: ${e.message}` }); }
  }
});
let active = 0;
let ended = false;
process.stdin.on("end", () => { ended = true; if (!active) process.exit(0); });

function handle(msg) {
  if (msg.type === "ping") return write({ pong: `node ${process.version}` });
  if (msg.type !== "claude") return write({ error: "Unknown request" });
  const model = ALLOWED_MODELS.has(msg.model) ? msg.model : "sonnet";
  const prompt = String(msg.prompt ?? "").slice(0, 12000);
  const system = String(msg.system ?? "").slice(0, 2000);
  // The prompt goes in on stdin, never through a shell, so page text cannot inject commands.
  const child = spawn(process.env.LUMEN_CLAUDE_BIN || "claude", ["-p", "--model", model, "--append-system-prompt", system], {
    stdio: ["pipe", "pipe", "pipe"],
    env: process.env,
  });
  active++;
  let err = "";
  child.stdout.on("data", (d) => write({ chunk: d.toString("utf8") }));
  child.stderr.on("data", (d) => { err += d.toString("utf8"); });
  child.on("error", (e) => write({ error: e.code === "ENOENT" ? "claude CLI not found on PATH. Set LUMEN_CLAUDE_BIN in install.sh." : e.message }));
  child.on("close", (code) => {
    write(code === 0 ? { done: true } : { error: err.trim().slice(0, 300) || `claude exited with ${code}` });
    if (--active === 0 && ended) process.exit(0);
  });
  child.stdin.end(prompt);
}
