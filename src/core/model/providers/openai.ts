import type { AssistantMessage, Message, StreamEvent, ToolCall, ToolRegistry, Usage } from "../../types";

type OpenAIChatMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: any[] }
  | { role: "tool"; content: string; tool_call_id?: string };

export async function* openaiQueryModel(params: {
  messages: Message[];
  tools: ToolRegistry;
  signal: AbortSignal;
  baseUrl: string;
  apiKey: string;
  model: string;
}): AsyncGenerator<StreamEvent | AssistantMessage> {
  const url = `${stripTrailingSlash(params.baseUrl)}/chat/completions`;

  const tools = buildOpenAITools(params.tools);
  const body = {
    model: params.model,
    stream: true,
    stream_options: { include_usage: true },
    tool_choice: tools.length ? "auto" : undefined,
    tools: tools.length ? tools : undefined,
    messages: toOpenAIMessages(params.messages),
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: params.signal,
  });

  if (!resp.ok || !resp.body) {
    const text = await safeReadText(resp);
    yield { type: "error", error: { message: `Model request failed (${resp.status}): ${text}` } };
    return;
  }

  const toolCallsByKey = new Map<string, { id?: string; name?: string; args: string }>();
  let assistantText = "";
  let usage: Usage | undefined;

  for await (const data of sseData(resp.body, params.signal)) {
    if (data === "[DONE]") break;
    let json: any;
    try {
      json = JSON.parse(data);
    } catch {
      continue;
    }

    const choice = json?.choices?.[0];
    const delta = choice?.delta;
    if (delta?.content) {
      assistantText += delta.content;
      yield { type: "text_delta", delta: delta.content };
    }

    const deltaToolCalls: any[] | undefined = delta?.tool_calls;
    if (Array.isArray(deltaToolCalls)) {
      for (const tc of deltaToolCalls) {
        const key = `idx:${tc?.index ?? 0}`;
        const prev = toolCallsByKey.get(key) ?? { id: undefined, name: undefined, args: "" };
        const id = tc?.id ?? prev.id;
        const name = tc?.function?.name ?? prev.name;
        const argsDelta = tc?.function?.arguments ?? "";
        toolCallsByKey.set(key, { id, name, args: prev.args + argsDelta });
      }
    }

    if (json?.usage) usage = normalizeUsage(json.usage);
  }

  const toolCalls: ToolCall[] = [];
  for (const v of toolCallsByKey.values()) {
    if (!v.name) continue;
    toolCalls.push({
      uuid: v.id,
      name: v.name,
      input: safeJsonParse(v.args),
    });
  }

  const msg: AssistantMessage = {
    role: "assistant",
    content: assistantText,
    toolCalls: toolCalls.length ? toolCalls : undefined,
    usage,
  };
  yield msg;
}

function stripTrailingSlash(s: string): string {
  return s.endsWith("/") ? s.slice(0, -1) : s;
}

async function safeReadText(resp: Response): Promise<string> {
  try {
    return await resp.text();
  } catch {
    return "";
  }
}

async function* sseData(body: ReadableStream<Uint8Array>, signal: AbortSignal): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  while (true) {
    if (signal.aborted) return;
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    while (true) {
      const idx = buf.indexOf("\n\n");
      if (idx < 0) break;
      const raw = buf.slice(0, idx);
      buf = buf.slice(idx + 2);

      const lines = raw.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const data = trimmed.slice("data:".length).trim();
        if (data) yield data;
      }
    }
  }
}

function toOpenAIMessages(messages: Message[]): OpenAIChatMessage[] {
  const out: OpenAIChatMessage[] = [];
  for (const m of messages) {
    if (m.role === "system") out.push({ role: "system", content: m.content });
    else if (m.role === "user") out.push({ role: "user", content: m.content });
    else if (m.role === "assistant") {
      const msg: OpenAIChatMessage = { role: "assistant", content: m.content ?? "" };
      if (m.toolCalls && m.toolCalls.length > 0) {
        msg.tool_calls = m.toolCalls.map((tc) => ({
          id: tc.uuid,
          type: "function",
          function: { name: tc.name, arguments: JSON.stringify(tc.input) },
        }));
      }
      out.push(msg);
    } else if (m.role === "assistant_summary") out.push({ role: "system", content: `Summary:\n${m.content}` });
    else if (m.role === "tool") out.push({ role: "tool", content: m.content, tool_call_id: m.toolCallId });
  }
  return out;
}

function buildOpenAITools(registry: ToolRegistry): any[] {
  const out: any[] = [];
  for (const t of registry.list()) {
    out.push({
      type: "function",
      function: {
        name: t.name,
        description: t.description ?? "",
        parameters: jsonSchemaForTool(t.name),
      },
    });
  }
  return out;
}

function jsonSchemaForTool(name: string): any {
  switch (name) {
    case "readFile":
      return {
        type: "object",
        additionalProperties: false,
        properties: {
          path: { type: "string" },
          maxBytes: { type: "integer", minimum: 1 },
        },
        required: ["path"],
      };
    case "search":
      return {
        type: "object",
        additionalProperties: false,
        properties: {
          query: { type: "string" },
          maxResults: { type: "integer", minimum: 1 },
          fileGlobs: { type: "array", items: { type: "string" } },
        },
        required: ["query"],
      };
    case "editFile":
      return {
        type: "object",
        additionalProperties: false,
        properties: {
          path: { type: "string" },
          content: { type: "string" },
          create: { type: "boolean" },
        },
        required: ["path", "content"],
      };
    case "runCommand":
      return {
        type: "object",
        additionalProperties: false,
        properties: {
          command: { type: "string" },
          cwd: { type: "string" },
          timeoutMs: { type: "integer", minimum: 1 },
          maxOutputBytes: { type: "integer", minimum: 1 },
        },
        required: ["command"],
      };
    default:
      return { type: "object" };
  }
}

function safeJsonParse(s: string): unknown {
  if (!s) return {};
  try {
    return JSON.parse(s);
  } catch {
    return { raw: s };
  }
}

function normalizeUsage(u: any): Usage {
  const prompt = typeof u?.prompt_tokens === "number" ? u.prompt_tokens : undefined;
  const completion = typeof u?.completion_tokens === "number" ? u.completion_tokens : undefined;
  const total = typeof u?.total_tokens === "number" ? u.total_tokens : undefined;
  return { inputTokens: prompt, outputTokens: completion, totalTokens: total };
}
