export type Role = "system" | "user" | "assistant" | "tool" | "assistant_summary";

export type Usage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

export type ToolCall = {
  uuid?: string;
  name: string;
  input: unknown;
};

export type AssistantMessage = {
  role: "assistant";
  content: string;
  toolCalls?: ToolCall[];
  usage?: Usage;
};

export type Message =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | AssistantMessage
  | { role: "assistant_summary"; content: string; coversTurns?: number }
  | {
      role: "tool";
      toolName: string;
      toolCallId?: string;
      content: string;
      ok: boolean;
      meta?: Record<string, unknown>;
    };

export type ToolPermission = { kind: "auto" } | { kind: "confirm" } | { kind: "deny" };

export type ToolExecutionContext = {
  workspaceRoot: string;
  sessionId: string;
  signal: AbortSignal;
  allowRun: boolean;
  allowEdit: boolean;
};

export type ToolSpec<TInput, TResult> = {
  name: string;
  description?: string;
  inputSchema: unknown;
  permission: ToolPermission;
  execute(input: TInput, ctx: ToolExecutionContext): Promise<TResult>;
};

export type ToolRegistry = {
  list(): Array<{ name: string; description?: string }>;
  get(name: string): ToolSpec<any, any> | undefined;
};

export type StreamEvent =
  | { type: "text_delta"; delta: string }
  | { type: "tool_call"; toolCall: ToolCall }
  | { type: "tool_result"; result: Message & { role: "tool" } }
  | { type: "usage"; usage: Usage }
  | { type: "final_state"; state: LoopState }
  | { type: "error"; error: { message: string; code?: string } };

export type SystemPrompt = { content: string };

export type ThinkingConfig = { enabled: boolean; budgetTokens?: number };

export type QueryParams = {
  messages: Message[];
  toolUseContext: {
    workspaceRoot: string;
    sessionId: string;
    allowRun: boolean;
    allowEdit: boolean;
  };
};

export type LoopState = {
  messages: Message[];
  toolUseContext: QueryParams["toolUseContext"];
  autoCompactTracking?: { proactiveCount: number; reactiveCount: number };
  maxOutputTokensRecoveryCount: number;
  hasAttemptedReactiveCompact: boolean;
  turnCount: number;
  usage?: Usage;
};
