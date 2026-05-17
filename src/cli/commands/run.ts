import { createToolRegistry } from "../../core/tools/registry";
import { editFileTool } from "../../core/tools/builtins/editFile";
import { readFileTool } from "../../core/tools/builtins/readFile";
import { runCommandTool } from "../../core/tools/builtins/runCommand";
import { searchTool } from "../../core/tools/builtins/search";
import type { Message } from "../../core/types";
import { queryLoop } from "../../core/loop/queryLoop";
import { createSessionId } from "../../infra/id";

export async function runOnce(params: {
  workspaceRoot: string;
  allowRun: boolean;
  allowEdit: boolean;
  task: string;
}): Promise<void> {
  const sessionId = createSessionId();
  const tools = createToolRegistry([readFileTool, searchTool, editFileTool, runCommandTool]);

  const messages: Message[] = [
    { role: "system", content: "You are Crystal." },
    { role: "user", content: params.task },
  ];

  const controller = new AbortController();

  for await (const ev of queryLoop({
    query: {
      messages,
      toolUseContext: {
        workspaceRoot: params.workspaceRoot,
        sessionId,
        allowRun: params.allowRun,
        allowEdit: params.allowEdit,
      },
    },
    tools,
    consumedCommandUuids: [],
    signal: controller.signal,
    logFromMessageIndex: 0,
  })) {
    if (ev.type === "text_delta") process.stdout.write(ev.delta);
    if (ev.type === "tool_result") {
      process.stdout.write("\n");
      process.stdout.write(`[tool:${ev.result.toolName}] ${ev.result.ok ? "ok" : "error"}\n`);
      process.stdout.write(`${ev.result.content}\n`);
    }
    if (ev.type === "error") {
      process.stdout.write(`\n[error] ${ev.error.message}\n`);
    }
  }

  process.stdout.write("\n");
}
