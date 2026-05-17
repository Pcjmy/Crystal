import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, Text, useApp, useInput } from "ink";
import { createToolRegistry } from "../core/tools/registry";
import { editFileTool } from "../core/tools/builtins/editFile";
import { readFileTool } from "../core/tools/builtins/readFile";
import { runCommandTool } from "../core/tools/builtins/runCommand";
import { searchTool } from "../core/tools/builtins/search";
import type { Message, ToolConfirmDecision, ToolConfirmRequest } from "../core/types";
import { queryLoop } from "../core/loop/queryLoop";

import type { ChatItem } from "./chat/types";
import { Banner } from "./chat/components/Banner";
import { MessageList } from "./chat/components/MessageList";
import { InputPanel } from "./chat/components/InputPanel";
import { StatusBar } from "./chat/components/StatusBar";
import { THEME, SPINNER_FRAMES } from "./chat/theme";
import { listSessionSummaries, loadSessionMessages } from "../infra/sessionLogs";

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
  const [sessionId, setSessionId] = useState(props.sessionId);
  const sessionIdRef = useRef(props.sessionId);
  const [allowEditInSession, setAllowEditInSession] = useState(props.allowEdit);
  const [pendingEditConfirm, setPendingEditConfirm] = useState<{ path: string } | null>(null);
  const [pendingDenyFeedback, setPendingDenyFeedback] = useState<{ path: string; value: string } | null>(null);
  const [confirmSelectionIndex, setConfirmSelectionIndex] = useState(0);
  const [resumeMenu, setResumeMenu] = useState<{
    loading: boolean;
    sessions: Array<{ sessionId: string; label: string }>;
    selectedIndex: number;
  } | null>(null);

  const messagesRef = useRef<Message[]>([{ role: "system", content: "You are Crystal." }]);
  const controllerRef = useRef<AbortController | null>(null);
  const pendingToolDecisionRef = useRef<((d: ToolConfirmDecision) => void) | null>(null);

  const [spinnerFrame, setSpinnerFrame] = useState(0);
  useEffect(() => {
    if (!busy) return;
    const id = setInterval(() => setSpinnerFrame((x) => (x + 1) % 10), 80);
    return () => clearInterval(id);
  }, [busy]);

  const onToolConfirm = useCallback(
    async (req: ToolConfirmRequest): Promise<ToolConfirmDecision> => {
      if (req.tool.name !== "editFile") return { action: "allow" };

      const path = (() => {
        if (typeof req.parsedInput !== "object" || req.parsedInput === null) return "file";
        const obj = req.parsedInput as Record<string, unknown>;
        const p = obj["path"];
        return typeof p === "string" && p.length ? p : "file";
      })();

      if (allowEditInSession) return { action: "allow", ctxPatch: { allowEdit: true } };

      return await new Promise<ToolConfirmDecision>((resolve) => {
        pendingToolDecisionRef.current = resolve;
        setConfirmSelectionIndex(0);
        setPendingEditConfirm({ path });
      });
    },
    [allowEditInSession],
  );

  const submit = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      if (busy) return;

      if (text.trim() === "/resume") {
        setResumeMenu({ loading: true, sessions: [], selectedIndex: 0 });
        try {
          const summaries = await listSessionSummaries(props.workspaceRoot);
          const top = summaries.slice(0, 20);
          setResumeMenu({
            loading: false,
            sessions: top.map((s) => ({ sessionId: s.sessionId, label: s.label })),
            selectedIndex: 0,
          });
        } catch (e) {
          setResumeMenu(null);
          setItems((prev) => [...prev, { kind: "error", text: e instanceof Error ? e.message : "Failed to load sessions" }]);
        }
        return;
      }

      setBusy(true);
      setItems((prev) => [...prev, { kind: "user", text }]);

      const baseMessageCount = messagesRef.current.length;
      messagesRef.current = [...messagesRef.current, { role: "user", content: text }];

      const controller = new AbortController();
      controllerRef.current = controller;

      const consumed: string[] = [];
      for await (const ev of queryLoop({
        query: {
          messages: messagesRef.current,
          toolUseContext: {
            workspaceRoot: props.workspaceRoot,
            sessionId: sessionIdRef.current,
            allowRun: props.allowRun,
            allowEdit: allowEditInSession,
          },
        },
        tools,
        consumedCommandUuids: consumed,
        signal: controller.signal,
        onToolConfirm,
        logFromMessageIndex: baseMessageCount,
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
    [allowEditInSession, busy, onToolConfirm, props.allowRun, props.workspaceRoot, tools],
  );

  useInput((ch, key) => {
    if (resumeMenu) {
      if (key.escape) {
        setResumeMenu(null);
        return;
      }

      if (!resumeMenu.loading) {
        if (key.upArrow) {
          setResumeMenu((s) =>
            s
              ? {
                  ...s,
                  selectedIndex: s.sessions.length ? (s.selectedIndex + s.sessions.length - 1) % s.sessions.length : 0,
                }
              : s,
          );
          return;
        }

        if (key.downArrow) {
          setResumeMenu((s) =>
            s ? { ...s, selectedIndex: s.sessions.length ? (s.selectedIndex + 1) % s.sessions.length : 0 } : s,
          );
          return;
        }

        if (key.return) {
          const selected = resumeMenu.sessions[resumeMenu.selectedIndex];
          if (!selected) {
            setResumeMenu(null);
            return;
          }

          void (async () => {
            try {
              const loaded = await loadSessionMessages(props.workspaceRoot, selected.sessionId);
              const msgs = normalizeMessages(loaded.messages);
              messagesRef.current = msgs;
              sessionIdRef.current = selected.sessionId;
              setSessionId(selected.sessionId);
              setItems(messagesToChatItems(msgs, selected.sessionId));
            } catch (e) {
              setItems((prev) => [...prev, { kind: "error", text: e instanceof Error ? e.message : "Failed to resume session" }]);
            } finally {
              setResumeMenu(null);
            }
          })();

          return;
        }
      }

      return;
    }

    if (key.ctrl && ch === "c") {
      controllerRef.current?.abort();
      exit();
      return;
    }

    if (key.ctrl && ch === "x") {
      controllerRef.current?.abort();
      const resolve = pendingToolDecisionRef.current;
      if (resolve) {
        pendingToolDecisionRef.current = null;
        setPendingEditConfirm(null);
        setPendingDenyFeedback(null);
        resolve({ action: "deny" });
      }
      return;
    }

    if (pendingDenyFeedback) {
      if (key.escape) {
        const resolve = pendingToolDecisionRef.current;
        pendingToolDecisionRef.current = null;
        setPendingDenyFeedback(null);
        resolve?.({ action: "deny" });
        return;
      }

      if (key.return) {
        const resolve = pendingToolDecisionRef.current;
        const feedback = pendingDenyFeedback.value.trim();
        const path = pendingDenyFeedback.path;
        if (feedback) setItems((prev) => [...prev, { kind: "user", text: feedback }]);
        pendingToolDecisionRef.current = null;
        setPendingDenyFeedback(null);
        resolve?.({
          action: "deny",
          userMessage: feedback
            ? `User denied the edit to ${path}. Please do differently: ${feedback}`
            : `User denied the edit to ${path}.`,
        });
        return;
      }

      if (key.backspace || key.delete) {
        setPendingDenyFeedback((s) => (s ? { ...s, value: s.value.slice(0, -1) } : s));
        return;
      }

      if (!key.ctrl && !key.meta && ch) {
        setPendingDenyFeedback((s) => (s ? { ...s, value: s.value + ch } : s));
        return;
      }

      return;
    }

    if (pendingEditConfirm) {
      if (key.upArrow) {
        setConfirmSelectionIndex((i) => (i + 2) % 3);
        return;
      }

      if (key.downArrow) {
        setConfirmSelectionIndex((i) => (i + 1) % 3);
        return;
      }

      if (key.return) {
        const resolve = pendingToolDecisionRef.current;
        const path = pendingEditConfirm.path;
        const selected = confirmSelectionIndex;
        pendingToolDecisionRef.current = null;
        setPendingEditConfirm(null);

        if (selected === 0) {
          resolve?.({ action: "allow", ctxPatch: { allowEdit: true } });
          return;
        }

        if (selected === 1) {
          setAllowEditInSession(true);
          resolve?.({ action: "allow", ctxPatch: { allowEdit: true } });
          return;
        }

        setPendingDenyFeedback({ path, value: "" });
        return;
      }

      if (ch === "1" && !key.ctrl && !key.meta) {
        const resolve = pendingToolDecisionRef.current;
        pendingToolDecisionRef.current = null;
        setPendingEditConfirm(null);
        resolve?.({ action: "allow", ctxPatch: { allowEdit: true } });
        return;
      }

      if ((ch === "2" && !key.ctrl && !key.meta) || (key.meta && ch.toLowerCase() === "m")) {
        const resolve = pendingToolDecisionRef.current;
        pendingToolDecisionRef.current = null;
        setPendingEditConfirm(null);
        setAllowEditInSession(true);
        resolve?.({ action: "allow", ctxPatch: { allowEdit: true } });
        return;
      }

      if ((ch === "3" && !key.ctrl && !key.meta) || key.escape) {
        const path = pendingEditConfirm.path;
        setPendingEditConfirm(null);
        setPendingDenyFeedback({ path, value: "" });
        return;
      }

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
        <InputPanel value={pendingDenyFeedback ? pendingDenyFeedback.value : input} busy={busy} spinner={spinner} />
        {!pendingEditConfirm && !pendingDenyFeedback && !resumeMenu ? (
          <StatusBar
            providerLabel={providerLabel}
            sessionId={sessionId}
            workspaceRoot={props.workspaceRoot}
            allowRun={props.allowRun}
            allowEdit={allowEditInSession}
            width={stdoutWidth}
            totalTokens={totalTokens}
          />
        ) : null}
        {pendingEditConfirm ? (
          <Box flexDirection="column" borderStyle="round" borderColor={THEME.panel} paddingX={1} paddingY={0} marginTop={1}>
            <Text>{`Do you want to make this edit to ${pendingEditConfirm.path}?`}</Text>
            <Text dimColor>{" "}</Text>
            <Text>
              <Text color={confirmSelectionIndex === 0 ? THEME.brand : THEME.hint}>
                {confirmSelectionIndex === 0 ? "> " : "  "}1. Yes
              </Text>
            </Text>
            <Text>
              <Text color={confirmSelectionIndex === 1 ? THEME.brand : THEME.hint}>
                {confirmSelectionIndex === 1 ? "> " : "  "}2. Yes, and don't ask again this session (alt + m)
              </Text>
            </Text>
            <Text>
              <Text color={confirmSelectionIndex === 2 ? THEME.brand : THEME.hint}>
                {confirmSelectionIndex === 2 ? "> " : "  "}3. No, and tell Crystal what to do differently (escape)
              </Text>
            </Text>
          </Box>
        ) : pendingDenyFeedback ? (
          <Box flexDirection="column" borderStyle="round" borderColor={THEME.panel} paddingX={1} paddingY={0} marginTop={1}>
            <Text>{`Tell Crystal what to do differently for ${pendingDenyFeedback.path}:`}</Text>
            <Text dimColor>{"Enter to send · Esc to deny without message"}</Text>
          </Box>
        ) : resumeMenu ? (
          <Box flexDirection="column" borderStyle="round" borderColor={THEME.panel} paddingX={1} paddingY={0} marginTop={1}>
            <Text color={THEME.brand}>Resume a session</Text>
            {resumeMenu.loading ? (
              <Text dimColor>Loading…</Text>
            ) : resumeMenu.sessions.length === 0 ? (
              <Text dimColor>No sessions found</Text>
            ) : (
              <Box flexDirection="column">
                {resumeMenu.sessions.slice(0, 20).map((s, i) => (
                  <Text key={s.sessionId}>
                    <Text color={i === resumeMenu.selectedIndex ? THEME.brand : THEME.hint}>
                      {i === resumeMenu.selectedIndex ? "> " : "  "}
                      {s.label}
                    </Text>
                  </Text>
                ))}
                <Text dimColor>{"Enter to resume · Esc to cancel"}</Text>
              </Box>
            )}
          </Box>
        ) : showHelp ? (
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

function normalizeMessages(messages: Message[]): Message[] {
  const out: Message[] = [];
  if (!messages.length || messages[0]?.role !== "system") out.push({ role: "system", content: "You are Crystal." });
  for (const m of messages) {
    if (m.role === "system" && out.length && out[0].role === "system") continue;
    out.push(m);
  }
  return out;
}

function messagesToChatItems(messages: Message[], resumedFromSessionId: string): ChatItem[] {
  const items: ChatItem[] = [];
  for (const m of messages) {
    if (m.role === "system") continue;
    if (m.role === "user") items.push({ kind: "user", text: m.content });
    else if (m.role === "assistant") items.push({ kind: "assistant", text: m.content });
    else if (m.role === "tool") items.push({ kind: "tool", toolName: m.toolName, ok: m.ok, content: m.content });
    else if (m.role === "assistant_summary") items.push({ kind: "meta", text: `Summary: ${m.content}` });
  }
  items.push({ kind: "meta", text: `Resumed ${resumedFromSessionId}` });
  return items;
}
