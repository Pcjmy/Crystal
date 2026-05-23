import React from "react";
import { Box, Text } from "ink";
import type { ChatItem } from "../types";

export function MessageRow(props: { item: ChatItem; width: number }) {
  const it = props.item;
  if (it.kind === "meta") {
    return (
      <Box>
        <Text dimColor>{it.text}</Text>
      </Box>
    );
  }

  if (it.kind === "user") {
    return (
      <Box>
        <Text color="cyanBright">
          <Text color="cyanBright">&gt; </Text>
          {it.text}
        </Text>
      </Box>
    );
  }

  if (it.kind === "assistant") {
    return (
      <Box>
        <Text color="white">
          <Text color="magentaBright">✦ </Text>
          {it.text}
        </Text>
      </Box>
    );
  }

  if (it.kind === "tool") {
    return <ToolPanel width={props.width} toolName={it.toolName} ok={it.ok} content={it.content} />;
  }

  return (
    <Box>
      <Text color="redBright">
        <Text color="redBright">✗ </Text>
        {it.text}
      </Text>
    </Box>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function ToolPanel(props: { width: number; toolName: string; ok: boolean; content: string }) {
  const isSearch = props.toolName === "search";
  const isReadFile = props.toolName === "readFile";
  const isEditFile = props.toolName === "editFile";
  const isRunCommand = props.toolName === "runCommand";
  
  let bodyText: string;
  try {
    const parsed = JSON.parse(props.content);
    if (isReadFile && parsed.ok) {
      const path = typeof parsed.path === "string" ? parsed.path : "file";
      const content = typeof parsed.content === "string" ? parsed.content : "";
      const lines = content ? content.split("\n").length : 0;
      const bytes = Buffer.byteLength(content, "utf8");
      bodyText = `Read ${path}\n${lines} lines (${formatBytes(bytes)})`;
    } else if (isEditFile && parsed.ok) {
      const path = typeof parsed.path === "string" ? parsed.path : "file";
      const text = typeof parsed.content === "string" ? parsed.content : "";
      const lines = text.split("\n");
      const preview = lines.slice(0, 3).join("\n");
      const more = lines.length > 3 ? `\n... (+${lines.length - 3} lines)` : "";
      bodyText = `Wrote ${path}\n${lines.length} lines\n\n${preview}${more}`;
    } else if (isSearch && parsed.ok) {
      const count = Array.isArray(parsed.matches) ? parsed.matches.length : 0;
      const query = typeof parsed.query === "string" ? parsed.query : "";
      const q = query ? `Search "${query}"\n` : "";
      bodyText = `${q}Found ${count} match${count === 1 ? "" : "es"}`;
    } else if (isRunCommand && typeof parsed === "object" && parsed !== null) {
      const command = typeof parsed.command === "string" ? parsed.command : "command";
      const cwd = typeof parsed.cwd === "string" ? parsed.cwd : "";
      const exitCode = typeof parsed.exitCode === "number" ? parsed.exitCode : undefined;
      const stdout = typeof parsed.stdout === "string" ? parsed.stdout : "";
      const stderr = typeof parsed.stderr === "string" ? parsed.stderr : "";

      const stdoutBytes = Buffer.byteLength(stdout, "utf8");
      const stderrBytes = Buffer.byteLength(stderr, "utf8");
      const stdoutLines = stdout ? stdout.split("\n").length : 0;
      const stderrLines = stderr ? stderr.split("\n").length : 0;

      const outLinesArr = stdout.trimEnd().split("\n");
      const errLinesArr = stderr.trimEnd().split("\n");
      const outPreview = stdout.trim() ? outLinesArr.slice(0, 3).join("\n") : "";
      const errPreview = stderr.trim() ? errLinesArr.slice(0, 3).join("\n") : "";
      const previewLabel = outPreview ? "stdout" : errPreview ? "stderr" : "";
      const previewText = outPreview || errPreview;
      const previewLines = outPreview ? outLinesArr.length : errPreview ? errLinesArr.length : 0;
      const previewMore = previewText && previewLines > 3 ? `\n... (+${previewLines - 3} lines)` : "";

      const exit = typeof exitCode === "number" ? `Exit ${exitCode}` : props.ok ? "OK" : "ERR";
      const cwdLine = cwd ? `\nCWD: ${cwd}` : "";
      const ioLine = `\nstdout: ${stdoutLines} lines (${formatBytes(stdoutBytes)}), stderr: ${stderrLines} lines (${formatBytes(stderrBytes)})`;
      const previewBlock = previewText ? `\n\n${previewLabel}:\n${previewText}${previewMore}` : "";

      bodyText = `Ran: ${command}${cwdLine}\n${exit}${ioLine}${previewBlock}`;
    } else if (parsed.error) {
      const baseError = String(parsed.error);
      if (isReadFile || isEditFile) {
        const path = typeof parsed.path === "string" ? parsed.path : "";
        bodyText = path ? `${path}\n${baseError}` : baseError;
      } else if (isRunCommand) {
        const command = typeof parsed.command === "string" ? parsed.command : "";
        const cwd = typeof parsed.cwd === "string" ? parsed.cwd : "";
        const cmdLine = command ? `Command: ${command}` : "";
        const cwdLine = cwd ? `\nCWD: ${cwd}` : "";
        bodyText = cmdLine ? `${cmdLine}${cwdLine}\n${baseError}` : baseError;
      } else {
        bodyText = baseError;
      }
    } else {
      bodyText = prettyContent(props.content);
    }
  } catch {
    bodyText = prettyContent(props.content);
  }

  const boxWidth = Math.max(30, Math.min(props.width - 4, 120));

  return (
    <Box
      flexDirection="column"
      width={boxWidth}
      borderStyle="round"
      borderColor={props.ok ? "green" : "red"}
      paddingX={1}
    >
      <Box justifyContent="space-between">
        <Text color={props.ok ? "greenBright" : "redBright"}>
          {props.ok ? "✓" : "✗"} <Text dimColor> {props.toolName}</Text>
        </Text>
        <Text color={props.ok ? "greenBright" : "redBright"}>{props.ok ? "OK" : "ERR"}</Text>
      </Box>
      <Text dimColor wrap="wrap">{bodyText}</Text>
    </Box>
  );
}

function prettyContent(content: string): string {
  const trimmed = content.trim();
  const max = 1200;
  const s = trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
  if (!s) return "";
  if (!s.startsWith("{") && !s.startsWith("[")) return s;
  try {
    const parsed = JSON.parse(s);
    if (parsed && typeof parsed.content === "string") {
      parsed.content = "... [Content truncated for display] ...";
    }
    return JSON.stringify(parsed, null, 2);
  } catch {
    return s;
  }
}
