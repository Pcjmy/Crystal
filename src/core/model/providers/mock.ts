import crypto from "node:crypto";
import type { AssistantMessage, Message, StreamEvent, ToolCall, ToolRegistry } from "../../types";

export async function* mockQueryModel(params: {
  messages: Message[];
  tools: ToolRegistry;
  signal: AbortSignal;
}): AsyncGenerator<StreamEvent | AssistantMessage> {
  const last = params.messages[params.messages.length - 1];
  const text = last && last.role === "user" ? last.content : "";

  const toolCalls = last && last.role === "user" ? parseSlashCommands(text) : [];
  const content = toolCalls.length
    ? `Queued ${toolCalls.length} tool call(s).`
    : last && last.role === "tool"
      ? "Observed tool result. No further tool calls."
      : "Mock model is enabled. Use /read, /search, /edit, /run to trigger tools.";

  for (const chunk of chunkText(content, 16)) {
    if (params.signal.aborted) break;
    yield { type: "text_delta", delta: chunk };
    await Bun.sleep(10);
  }

  if (toolCalls.length) {
    for (const tc of toolCalls) yield { type: "tool_call", toolCall: tc };
  }

  const msg: AssistantMessage = {
    role: "assistant",
    content,
    toolCalls: toolCalls.length ? toolCalls : undefined,
  };
  yield msg;
}

function chunkText(s: string, size: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < s.length; i += size) out.push(s.slice(i, i + size));
  return out;
}

function parseSlashCommands(input: string): ToolCall[] {
  const t = input.trim();
  if (!t.startsWith("/")) return [];
  const [cmd, ...rest] = t.split(" ");
  const arg = rest.join(" ").trim();
  const uuid = crypto.randomUUID();

  switch (cmd) {
    case "/read":
      return arg ? [{ uuid, name: "readFile", input: { path: arg } }] : [];
    case "/search":
      return arg ? [{ uuid, name: "search", input: { query: arg } }] : [];
    case "/run":
      return arg ? [{ uuid, name: "runCommand", input: { command: arg } }] : [];
    case "/edit": {
      const firstSpace = arg.indexOf(" ");
      if (firstSpace <= 0) return [];
      const path = arg.slice(0, firstSpace);
      const content = arg.slice(firstSpace + 1);
      return [{ uuid, name: "editFile", input: { path, content } }];
    }
    default:
      return [];
  }
}
