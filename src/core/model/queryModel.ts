import type { AssistantMessage, Message, StreamEvent, SystemPrompt, ThinkingConfig, ToolRegistry } from "../types";
import { mockQueryModel } from "./providers/mock";
import { openaiQueryModel } from "./providers/openai";

export async function* queryModel(
  messages: Message[],
  systemPrompt: SystemPrompt,
  thinkingConfig: ThinkingConfig,
  tools: ToolRegistry,
  signal: AbortSignal,
  options: { provider?: "mock" | "openai" } = {},
): AsyncGenerator<StreamEvent | AssistantMessage> {
  void thinkingConfig;

  const provider = options.provider ?? (process.env.CRYSTAL_PROVIDER as any) ?? "mock";
  switch (provider) {
    case "mock":
      yield* mockQueryModel({ messages, tools, signal });
      return;
    case "openai": {
      const baseUrl = process.env.CRYSTAL_BASE_URL ?? "";
      const apiKey = process.env.CRYSTAL_API_KEY ?? "";
      const model = process.env.CRYSTAL_MODEL ?? "";
      if (!apiKey || !baseUrl || !model) {
        yield {
          type: "error",
          error: {
            message:
              "Missing required OpenAI environment variables: CRYSTAL_API_KEY, CRYSTAL_BASE_URL, or CRYSTAL_MODEL.",
            code: "missing_config",
          },
        };
        return;
      }

      const merged = mergeSystemPrompt(messages, systemPrompt);
      yield* openaiQueryModel({ messages: merged, tools, signal, baseUrl, apiKey, model });
      return;
    }
    default:
      yield* mockQueryModel({ messages, tools, signal });
      return;
  }
}

function mergeSystemPrompt(messages: Message[], systemPrompt: SystemPrompt): Message[] {
  const first = messages[0];
  if (first && first.role === "system") {
    return [{ role: "system", content: `${systemPrompt.content}\n\n${first.content}` }, ...messages.slice(1)];
  }
  return [{ role: "system", content: systemPrompt.content }, ...messages];
}
