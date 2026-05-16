import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, Text, useApp, useInput } from "ink";
import { createToolRegistry } from "../core/tools/registry";
import { editFileTool } from "../core/tools/builtins/editFile";
import { readFileTool } from "../core/tools/builtins/readFile";
import { runCommandTool } from "../core/tools/builtins/runCommand";
import { searchTool } from "../core/tools/builtins/search";
import type { Message } from "../core/types";
import { queryLoop } from "../core/loop/queryLoop";

import type { ChatItem } from "./chat/types";
import { Banner } from "./chat/components/Banner";
import { MessageList } from "./chat/components/MessageList";
import { InputPanel } from "./chat/components/InputPanel";
import { StatusBar } from "./chat/components/StatusBar";
import { THEME, SPINNER_FRAMES } from "./chat/theme";

export function ChatApp(props: { workspaceRoot: string; sessionId: string; allowRun: boolean; allowEdit: boolean }) {
  const { exit } = useApp();
  const stdoutWidth = typeof process.stdout.columns === "number" ? process.stdout.columns : 100;

  const tools = useMemo(() => createToolRegistry([readFileTool, searchTool, editFileTool, runCommandTool]), []);

  const providerLabel = useMemo(() => {
    const provider = process.env.CRYSTAL_PROVIDER ?? "mock";
    const model = process.env.CRYSTAL_MODEL ? ` · ${process.env.CRYSTAL_MODEL}` : "";
    return `${provider}${model}`;
  }, []);

  const [items, setItems] = useState<ChatItem[]>([
    { kind: "assistant", text: "Crystal is ready." },
    { kind: "assistant", text: "Tips: /read <path> · /search <text> · /edit <path> <content> · /run <command>" },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [totalTokens, setTotalTokens] = useState(0);

  const messagesRef = useRef<Message[]>([{ role: "system", content: "You are Crystal." }]);
  const controllerRef = useRef<AbortController | null>(null);

  const [spinnerFrame, setSpinnerFrame] = useState(0);
  useEffect(() => {
    if (!busy) return;
    const id = setInterval(() => setSpinnerFrame((x) => (x + 1) % 10), 80);
    return () => clearInterval(id);
  }, [busy]);

  const submit = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      if (busy) return;

      setBusy(true);
      setItems((prev) => [...prev, { kind: "user", text }]);

      messagesRef.current = [...messagesRef.current, { role: "user", content: text }];

      const controller = new AbortController();
      controllerRef.current = controller;

      const consumed: string[] = [];
      for await (const ev of queryLoop({
        query: {
          messages: messagesRef.current,
          toolUseContext: {
            workspaceRoot: props.workspaceRoot,
            sessionId: props.sessionId,
            allowRun: props.allowRun,
            allowEdit: props.allowEdit,
          },
        },
        tools,
        consumedCommandUuids: consumed,
        signal: controller.signal,
      })) {
        if (ev.type === "text_delta") {
          setItems((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (!last || last.kind !== "assistant") {
              next.push({ kind: "assistant", text: ev.delta });
              return next;
            }
            next[next.length - 1] = { kind: "assistant", text: last.text + ev.delta };
            return next;
          });
        }

        if (ev.type === "tool_result") {
          setItems((prev) => [
            ...prev,
            {
              kind: "tool",
              toolName: ev.result.toolName,
              ok: ev.result.ok,
              content: ev.result.content,
            },
          ]);
        }

        if (ev.type === "error") {
          setItems((prev) => [...prev, { kind: "error", text: ev.error.message }]);
        }

        if (ev.type === "usage" && ev.usage?.totalTokens) {
          setTotalTokens((prev) => prev + (ev.usage?.totalTokens ?? 0));
        }

        if (ev.type === "final_state") {
          messagesRef.current = ev.state.messages;
        }
      }

      controllerRef.current = null;
      setBusy(false);
    },
    [busy, props.allowEdit, props.allowRun, props.sessionId, props.workspaceRoot, tools],
  );

  useInput((ch, key) => {
    if (key.ctrl && ch === "c") {
      controllerRef.current?.abort();
      exit();
      return;
    }

    if (key.escape) {
      controllerRef.current?.abort();
      exit();
      return;
    }

    if (key.return) {
      const text = input;
      setInput("");
      void submit(text);
      return;
    }

    if (key.backspace || key.delete) {
      setInput((s) => s.slice(0, -1));
      return;
    }

    if (key.ctrl && ch === "l") {
      setItems([{ kind: "assistant", text: "Cleared." }]);
      return;
    }

    if (key.ctrl && ch === "x") {
      controllerRef.current?.abort();
      return;
    }

    if (ch === "?" && !key.ctrl && !key.meta) {
      setShowHelp((v) => !v);
      return;
    }

    if (!key.ctrl && !key.meta && ch) setInput((s) => s + ch);
  });

  const spinner = busy ? SPINNER_FRAMES[spinnerFrame] : " ";

  return (
    <Box flexDirection="column" paddingX={1} paddingY={1} height="100%">
      <Box
        borderStyle="round"
        borderColor={THEME.brand}
        paddingX={1}
        paddingY={0}
        flexDirection="column"
        marginBottom={1}
      >
        <Box justifyContent="space-between">
          <Banner title="CRYSTAL" width={stdoutWidth} />
          <Text dimColor>{spinner}</Text>
        </Box>
        <Text dimColor>?: help · Ctrl+C / Esc exit · Ctrl+L clear · Ctrl+X abort</Text>
      </Box>

      <Box flexGrow={1} minHeight={8} borderStyle="round" borderColor={THEME.panel} paddingX={1} paddingY={0}>
        <MessageList items={items} width={stdoutWidth} />
      </Box>

      <Box marginTop={1} flexDirection="column">
        <InputPanel value={input} busy={busy} spinner={spinner} />
        <StatusBar
          providerLabel={providerLabel}
          sessionId={props.sessionId}
          workspaceRoot={props.workspaceRoot}
          allowRun={props.allowRun}
          allowEdit={props.allowEdit}
          width={stdoutWidth}
          totalTokens={totalTokens}
        />
        {showHelp ? (
          <Box
            flexDirection="column"
            borderStyle="round"
            borderColor={THEME.panel}
            paddingX={1}
            paddingY={0}
            marginTop={1}
          >
            <Box>
              <Text backgroundColor="gray" color="black">
                {" "}
                KEYS{" "}
              </Text>
              <Text> </Text>
              <Text dimColor>?: toggle help · Ctrl+C/Esc exit · Ctrl+L clear · Ctrl+X abort loop</Text>
            </Box>
            <Box>
              <Text backgroundColor="gray" color="black">
                {" "}
                TOOLS{" "}
              </Text>
              <Text> </Text>
              <Text dimColor>/read /search /edit /run</Text>
            </Box>
            <Box>
              <Text backgroundColor="gray" color="black">
                {" "}
                FLAGS{" "}
              </Text>
              <Text> </Text>
              <Text dimColor>--allow-edit --allow-run --provider (mock|openai) --base-url --model</Text>
            </Box>
          </Box>
        ) : (
          <Text dimColor>?: help · /read /search /edit /run</Text>
        )}
      </Box>
    </Box>
  );
}
