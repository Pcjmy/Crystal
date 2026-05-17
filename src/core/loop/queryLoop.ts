import type {
  AssistantMessage,
  LoopState,
  Message,
  QueryParams,
  StreamEvent,
  ToolCall,
  ToolConfirmDecision,
  ToolConfirmRequest,
  ToolExecutionContext,
  ToolRegistry,
} from "../types";
import { maybeCompact } from "./compact";
import { queryModel } from "../model/queryModel";
import { createSessionLogger } from "../../infra/log";

export async function* queryLoop(params: {
  query: QueryParams;
  tools: ToolRegistry;
  consumedCommandUuids: string[];
  signal: AbortSignal;
  onToolConfirm?: (req: ToolConfirmRequest) => Promise<ToolConfirmDecision> | ToolConfirmDecision;
}): AsyncGenerator<StreamEvent> {
  const logger = createSessionLogger({
    workspaceRoot: params.query.toolUseContext.workspaceRoot,
    sessionId: params.query.toolUseContext.sessionId,
  });

  await logger.write({
    event: "session_start",
    data: {
      workspaceRoot: params.query.toolUseContext.workspaceRoot,
      allowRun: params.query.toolUseContext.allowRun,
      allowEdit: params.query.toolUseContext.allowEdit,
      provider: process.env.CRYSTAL_PROVIDER ?? "mock",
      model: process.env.CRYSTAL_MODEL ?? null,
      baseUrl: process.env.CRYSTAL_BASE_URL ?? null,
    },
  });

  let state: LoopState = {
    messages: params.query.messages,
    toolUseContext: params.query.toolUseContext,
    autoCompactTracking: { proactiveCount: 0, reactiveCount: 0 },
    maxOutputTokensRecoveryCount: 0,
    hasAttemptedReactiveCompact: false,
    turnCount: 1,
  };

  while (true) {
    if (params.signal.aborted) break;
    if (state.turnCount > 20) {
      yield { type: "error", error: { message: "Max turn limit reached", code: "max_turns" } };
      break;
    }

    state = maybeCompact(state);

    await logger.write({
      event: "turn_start",
      turn: state.turnCount,
      data: {
        messageCount: state.messages.length,
        compact: state.autoCompactTracking ?? null,
      },
    });

    if (state.turnCount === 1) {
      const lastMsg = state.messages[state.messages.length - 1];
      if (lastMsg && lastMsg.role === "user") {
        await logger.write({
          event: "user_message",
          turn: state.turnCount,
          data: { content: lastMsg.content },
        });
      }
    }

    const systemPrompt = { content: "You are Crystal, a terminal-first coding assistant." };
    const thinkingConfig = { enabled: false };

    let assistant: AssistantMessage | undefined;
    const streamedToolCalls: ToolCall[] = [];
    let streamDeltaCount = 0;
    let streamCharCount = 0;

    for await (const ev of queryModel(state.messages, systemPrompt, thinkingConfig, params.tools, params.signal)) {
      if (params.signal.aborted) break;
      if (isAssistantMessage(ev)) {
        assistant = ev;
        continue;
      }
      if (ev.type === "tool_call") streamedToolCalls.push(ev.toolCall);
      if (ev.type === "text_delta") {
        streamDeltaCount += 1;
        streamCharCount += ev.delta.length;
      }
      if (ev.type === "error") {
        yield ev;
        await logger.write({
          event: "turn_error",
          turn: state.turnCount,
          data: { code: ev.error.code ?? "api_error", message: ev.error.message },
        });
        return; // Halt loop on model error
      }
      yield ev;
    }

    if (!assistant) {
      yield { type: "error", error: { message: "Model did not return a final message", code: "no_final" } };
      await logger.write({
        event: "turn_error",
        turn: state.turnCount,
        data: { code: "no_final", message: "Model did not return a final message" },
      });
      break;
    }

    const modelToolCalls = assistant.toolCalls ?? [];
    const toolCalls = mergeToolCalls([...streamedToolCalls, ...modelToolCalls]);

    const newToolCalls = toolCalls.filter((tc) => {
      if (!tc.uuid) return true;
      return !params.consumedCommandUuids.includes(tc.uuid);
    });

    state.messages = [
      ...state.messages,
      { role: "assistant", content: assistant.content, toolCalls: toolCalls.length ? toolCalls : undefined },
    ];

    if (assistant.usage) {
      yield { type: "usage", usage: assistant.usage };
    }

    await logger.write({
      event: "assistant_message",
      turn: state.turnCount,
      data: {
        stream: { deltaCount: streamDeltaCount, charCount: streamCharCount },
        content: truncate(assistant.content, 12_000),
        toolCalls: toolCalls.map((t) => ({ uuid: t.uuid ?? null, name: t.name })),
        usage: assistant.usage ?? null,
      } as any,
    });

    if (newToolCalls.length === 0) {
      await logger.write({ event: "turn_end", turn: state.turnCount, data: { toolCallsExecuted: 0 } });
      break;
    }

    let toolCallsExecuted = 0;
    for (const tc of newToolCalls) {
      if (params.signal.aborted) break;

      const tool = params.tools.get(tc.name);
      const parsed =
        tool && tool.permission.kind === "confirm" ? safeParse(tool.inputSchema, tc.input) : { ok: true as const, data: tc.input };

      const baseCtx: ToolExecutionContext = {
        workspaceRoot: state.toolUseContext.workspaceRoot,
        sessionId: state.toolUseContext.sessionId,
        signal: params.signal,
        allowRun: state.toolUseContext.allowRun,
        allowEdit: state.toolUseContext.allowEdit,
      };

      let decision: ToolConfirmDecision | undefined;
      if (tool && tool.permission.kind === "confirm" && parsed.ok && params.onToolConfirm) {
        const req: ToolConfirmRequest = {
          toolCall: tc,
          tool: { name: tool.name, description: tool.description, permission: tool.permission },
          parsedInput: parsed.data,
          ctx: {
            workspaceRoot: baseCtx.workspaceRoot,
            sessionId: baseCtx.sessionId,
            allowRun: baseCtx.allowRun,
            allowEdit: baseCtx.allowEdit,
          },
        };
        decision = await params.onToolConfirm(req);
      }

      await logger.write({
        event: "tool_call",
        turn: state.turnCount,
        data: { uuid: tc.uuid ?? null, name: tc.name, input: safeLogValue(tc.input) } as any,
      });

      let resultMsg: Message & { role: "tool" };
      if (decision?.action === "deny") {
        resultMsg = {
          role: "tool",
          toolName: tc.name,
          toolCallId: tc.uuid,
          ok: false,
          content: JSON.stringify({ ok: false, error: "User denied tool execution" }),
        };
      } else {
        const ctx =
          decision?.action === "allow" && decision.ctxPatch ? ({ ...baseCtx, ...decision.ctxPatch } as ToolExecutionContext) : baseCtx;
        resultMsg = await executeToolCall({ toolCall: tc, tools: params.tools, ctx });
      }

      if (tc.uuid) params.consumedCommandUuids.push(tc.uuid);
      state.messages = [...state.messages, resultMsg];
      const event: StreamEvent = { type: "tool_result", result: resultMsg };
      yield event;
      toolCallsExecuted += 1;
      await logger.write({
        event: "tool_result",
        turn: state.turnCount,
        data: {
          toolName: resultMsg.toolName,
          ok: resultMsg.ok,
          toolCallId: resultMsg.toolCallId ?? null,
          content: truncate(resultMsg.content, 12_000),
        } as any,
      });

      if (decision?.action === "deny") {
        if (decision.userMessage) {
          state.messages = [...state.messages, { role: "user", content: decision.userMessage }];
          await logger.write({
            event: "user_message",
            turn: state.turnCount,
            data: { content: decision.userMessage },
          });
        }
        break;
      }
    }

    await logger.write({ event: "turn_end", turn: state.turnCount, data: { toolCallsExecuted } });
    state.turnCount += 1;
  }

  yield { type: "final_state", state };
  await logger.write({ event: "session_end", data: { turns: state.turnCount } });
}

function isAssistantMessage(v: unknown): v is AssistantMessage {
  return (
    typeof v === "object" && v !== null && (v as any).role === "assistant" && typeof (v as any).content === "string"
  );
}

function mergeToolCalls(toolCalls: ToolCall[]): ToolCall[] {
  const seen = new Set<string>();
  const out: ToolCall[] = [];
  for (const tc of toolCalls) {
    const k = tc.uuid ? `uuid:${tc.uuid}` : `hash:${tc.name}:${stableStringify(tc.input)}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(tc);
  }
  return out;
}

function stableStringify(v: unknown): string {
  if (v === null) return "null";
  if (typeof v === "string") return JSON.stringify(v);
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    const keys = Object.keys(o).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`).join(",")}}`;
  }
  return JSON.stringify(String(v));
}

async function executeToolCall(params: {
  toolCall: ToolCall;
  tools: ToolRegistry;
  ctx: any;
}): Promise<Message & { role: "tool" }> {
  const tool = params.tools.get(params.toolCall.name);
  if (!tool) {
    return {
      role: "tool",
      toolName: params.toolCall.name,
      toolCallId: params.toolCall.uuid,
      ok: false,
      content: JSON.stringify({ ok: false, error: "Unknown tool" }),
    };
  }

  if (tool.permission.kind === "deny") {
    return {
      role: "tool",
      toolName: tool.name,
      toolCallId: params.toolCall.uuid,
      ok: false,
      content: JSON.stringify({ ok: false, error: "Tool denied by policy" }),
    };
  }

  const parsed = safeParse(tool.inputSchema, params.toolCall.input);
  if (!parsed.ok) {
    return {
      role: "tool",
      toolName: tool.name,
      toolCallId: params.toolCall.uuid,
      ok: false,
      content: JSON.stringify({ ok: false, error: "Invalid tool input", issues: parsed.issues }),
    };
  }

  try {
    const res = await tool.execute(parsed.data, params.ctx);
    const ok = typeof res === "object" && res !== null && "ok" in (res as any) ? Boolean((res as any).ok) : true;
    return {
      role: "tool",
      toolName: tool.name,
      toolCallId: params.toolCall.uuid,
      ok,
      content: JSON.stringify(res),
    };
  } catch (e) {
    return {
      role: "tool",
      toolName: tool.name,
      toolCallId: params.toolCall.uuid,
      ok: false,
      content: JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "Unknown error" }),
    };
  }
}

function safeParse(schema: unknown, input: unknown): { ok: true; data: any } | { ok: false; issues?: unknown } {
  if (schema && typeof schema === "object" && typeof (schema as any).safeParse === "function") {
    const r = (schema as any).safeParse(input);
    if (r.success) return { ok: true, data: r.data };
    return { ok: false, issues: r.error?.issues };
  }
  return { ok: true, data: input };
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}

function safeLogValue(v: unknown): unknown {
  try {
    const s = stableStringify(v);
    if (s.length <= 4_000) return v as any;
    return { truncated: true, preview: s.slice(0, 4_000) };
  } catch {
    return { unserializable: true };
  }
}
