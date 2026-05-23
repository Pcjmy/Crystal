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
  
  let bodyText: string;
  try {
    const parsed = JSON.parse(props.content);
    if (isReadFile && parsed.ok) {
      const lines = (parsed.content as string).split("\n").length;
      const bytes = Buffer.byteLength(parsed.content as string, "utf8");
      bodyText = `Read ${lines} lines (${formatBytes(bytes)})`;
    } else if (isEditFile && parsed.ok) {
      const text = parsed.content as string;
      const lines = text.split("\n");
      const preview = lines.slice(0, 3).join("\n");
      const more = lines.length > 3 ? `\n... (+${lines.length - 3} lines)` : "";
      bodyText = `Wrote ${lines.length} lines\n\n${preview}${more}`;
    } else if (isSearch && parsed.ok) {
      const count = Array.isArray(parsed.matches) ? parsed.matches.length : 0;
      bodyText = `Found ${count} match${count === 1 ? "" : "es"}`;
    } else if (parsed.error) {
      bodyText = String(parsed.error);
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
