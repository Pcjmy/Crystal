import fs from "node:fs/promises";
import path from "node:path";
import moment from "moment";
import type { LogEntry } from "./log";
import type { Message } from "../core/types";

export async function listSessionSummaries(workspaceRoot: string): Promise<Array<{ sessionId: string; label: string }>> {
  const dir = path.join(workspaceRoot, ".crystal", "sessions");
  let entries: Array<{ name: string; mtimeMs: number }>;
  try {
    const names = await fs.readdir(dir);
    const jsonl = names.filter((n) => n.endsWith(".jsonl"));
    const stats = await Promise.all(
      jsonl.map(async (name) => {
        try {
          const st = await fs.stat(path.join(dir, name));
          return { name, mtimeMs: st.mtimeMs };
        } catch {
          return null;
        }
      }),
    );
    entries = stats.filter((x): x is { name: string; mtimeMs: number } => Boolean(x));
  } catch {
    return [];
  }

  entries.sort((a, b) => b.mtimeMs - a.mtimeMs);

  const out: Array<{ sessionId: string; label: string }> = [];
  for (const e of entries.slice(0, 50)) {
    const sessionId = e.name.replace(/\.jsonl$/, "");
    const label = await buildSessionLabel({ workspaceRoot, sessionId });
    out.push({ sessionId, label });
  }

  return out;
}

export async function loadSessionMessages(workspaceRoot: string, sessionId: string): Promise<{ messages: Message[] }> {
  const filePath = path.join(workspaceRoot, ".crystal", "sessions", `${sessionId}.jsonl`);
  const text = await fs.readFile(filePath, "utf8");
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  const entries: LogEntry[] = [];
  for (const line of lines) {
    try {
      entries.push(JSON.parse(line) as LogEntry);
    } catch {
      continue;
    }
  }

  const appended: Message[] = [];
  for (const e of entries) {
    if (e.event !== "message_append") continue;
    const msg = (e.data as any)?.message as Message | undefined;
    if (!msg) continue;
    appended.push(msg);
  }

  const fallback: Message[] = [{ role: "system", content: "You are Crystal." }];
  for (const e of entries) {
    if (e.event === "user_message") {
      const content = (e.data as any)?.content;
      if (typeof content === "string") fallback.push({ role: "user", content });
    }
    if (e.event === "assistant_message") {
      const content = (e.data as any)?.content;
      if (typeof content === "string") fallback.push({ role: "assistant", content });
    }
    if (e.event === "tool_result") {
      const toolName = (e.data as any)?.toolName;
      const ok = (e.data as any)?.ok;
      const toolCallId = (e.data as any)?.toolCallId;
      const content = (e.data as any)?.content;
      if (typeof toolName === "string" && typeof ok === "boolean" && typeof content === "string") {
        fallback.push({ role: "tool", toolName, ok, toolCallId: typeof toolCallId === "string" ? toolCallId : undefined, content });
      }
    }
  }

  if (appended.length === 0) return { messages: fallback };

  const hasSystemInAppended = appended.some((m) => m.role === "system");
  if (hasSystemInAppended) return { messages: appended };

  return { messages: mergeMessages(fallback, appended) };
}

async function buildSessionLabel(params: { workspaceRoot: string; sessionId: string }): Promise<string> {
  const filePath = path.join(params.workspaceRoot, ".crystal", "sessions", `${params.sessionId}.jsonl`);
  let text: string;
  try {
    text = await fs.readFile(filePath, "utf8");
  } catch {
    return params.sessionId;
  }

  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  const entries: LogEntry[] = [];
  for (const line of lines.slice(0, 400)) {
    try {
      entries.push(JSON.parse(line) as LogEntry);
    } catch {
      continue;
    }
  }

  const startedAt = entries.find((e) => e.event === "session_start")?.at;
  const lastAt = findLastLogAt(lines);

  let preview: string | undefined;
  for (const e of entries) {
    if (e.event !== "message_append") continue;
    const msg = (e.data as any)?.message as Message | undefined;
    if (msg?.role !== "user") continue;
    preview = truncateOneLine(msg.content, 60);
    break;
  }
  if (!preview) {
    const userMsg = entries.find((e) => e.event === "user_message");
    const content = (userMsg?.data as any)?.content;
    if (typeof content === "string") preview = truncateOneLine(content, 60);
  }

  const displayAt = lastAt ?? startedAt;
  const datePart = displayAt ? moment.utc(displayAt).utcOffset(8).format("YYYY-MM-DD HH:mm:ss") : params.sessionId;
  const tail = params.sessionId.split("_").slice(-1)[0] ?? params.sessionId;
  const body = preview ? ` — ${preview}` : "";
  return `${datePart} · ${tail}${body}`;
}

function findLastLogAt(lines: string[]): string | undefined {
  for (let i = lines.length - 1; i >= 0 && i >= lines.length - 20; i--) {
    const line = lines[i];
    if (!line) continue;
    const e = tryParseLogEntry(line);
    if (typeof e?.at === "string") return e.at;
  }
  return undefined;
}

function tryParseLogEntry(line: string): LogEntry | null {
  try {
    return JSON.parse(line) as LogEntry;
  } catch {
    return null;
  }
}

function truncateOneLine(s: string, max: number): string {
  const one = s.replaceAll(/\s+/g, " ").trim();
  if (one.length <= max) return one;
  return `${one.slice(0, max)}…`;
}

function mergeMessages(a: Message[], b: Message[]): Message[] {
  const out: Message[] = [];
  const seen = new Set<string>();
  for (const msg of [...a, ...b]) {
    const k = stableMessageKey(msg);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(msg);
  }
  return out;
}

function stableMessageKey(m: Message): string {
  if (m.role === "tool") {
    return `tool:${m.toolName}:${m.toolCallId ?? ""}:${m.ok}:${m.content}`;
  }
  if (m.role === "assistant") {
    return `assistant:${m.content}:${JSON.stringify(m.toolCalls ?? [])}`;
  }
  if (m.role === "assistant_summary") return `assistant_summary:${m.content}:${m.coversTurns ?? ""}`;
  return `${m.role}:${m.content}`;
}
