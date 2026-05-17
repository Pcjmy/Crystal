import React from "react";
import { Box, Text } from "ink";
import path from "node:path";
import { THEME } from "../theme";

export function StatusBar(props: {
  providerLabel: string;
  sessionId: string;
  workspaceRoot: string;
  allowRun: boolean;
  allowEdit: boolean;
  width: number;
  totalTokens?: number;
}) {
  const rootName = path.basename(props.workspaceRoot);
  const sessionSuffix = props.sessionId.split("_").slice(-1)[0] ?? props.sessionId;
  const sessionShort = sessionSuffix.slice(0, 8);

  const perms = [];
  if (props.allowEdit) perms.push("edit");
  if (props.allowRun) perms.push("run");
  const permStr = perms.length > 0 ? `[${perms.join(", ")}]` : "[read-only]";

  const formatTokens = (n: number): string => {
    if (n < 1_000) return String(n);
    if (n < 10_000) return `${(n / 1_000).toFixed(1)}k`;
    if (n < 1_000_000) return `${Math.round(n / 1_000)}k`;
    return `${(n / 1_000_000).toFixed(1)}m`;
  };

  return (
    <Box justifyContent="space-between" marginTop={1}>
      <Box>
        <Text color="cyanBright">⚙ </Text>
        <Text color="white">{props.providerLabel}</Text>
        {typeof props.totalTokens === "number" ? (
          <Text color="yellowBright">
            <Text color={THEME.subtle}> · </Text>
            {formatTokens(props.totalTokens)} tokens
          </Text>
        ) : null}
      </Box>
      <Box>
        <Text color={perms.length > 0 ? THEME.ok : THEME.hint}>{permStr}</Text>
        <Text color={THEME.subtle}> · </Text>
        <Text color="blueBright">{rootName}</Text>
        <Text color={THEME.subtle}> · </Text>
        <Text color="magentaBright">{sessionShort}</Text>
      </Box>
    </Box>
  );
}
