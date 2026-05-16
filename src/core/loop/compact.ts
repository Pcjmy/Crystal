import type { LoopState, Message } from "../types";

export function maybeCompact(state: LoopState, params?: { maxMessages?: number }): LoopState {
  const maxMessages = params?.maxMessages ?? 40;
  if (state.messages.length <= maxMessages) return state;

  const keepTail = 20;
  const head = state.messages.slice(0, Math.max(0, state.messages.length - keepTail));
  const tail = state.messages.slice(-keepTail);

  const summaryText = summarizeMessages(head);
  const summary: Message = { role: "assistant_summary", content: summaryText, coversTurns: head.length };

  return {
    ...state,
    messages: [
      state.messages.find((m) => m.role === "system") ?? { role: "system", content: "" },
      summary,
      ...tail.filter((m) => m.role !== "system"),
    ],
    autoCompactTracking: {
      proactiveCount: (state.autoCompactTracking?.proactiveCount ?? 0) + 1,
      reactiveCount: state.autoCompactTracking?.reactiveCount ?? 0,
    },
  };
}

function summarizeMessages(messages: Message[]): string {
  const parts: string[] = [];
  for (const m of messages) {
    if (m.role === "system") continue;
    if (m.role === "tool") {
      parts.push(`Tool ${m.toolName}: ${m.ok ? "ok" : "error"}`);
      continue;
    }
    parts.push(`${m.role}: ${trim(m.content, 200)}`);
  }
  return parts.join("\n");
}

function trim(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}
