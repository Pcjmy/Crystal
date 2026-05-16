export type ChatItem =
  | { kind: "user"; text: string }
  | { kind: "assistant"; text: string }
  | { kind: "tool"; toolName: string; ok: boolean; content: string }
  | { kind: "error"; text: string }
  | { kind: "meta"; text: string };
