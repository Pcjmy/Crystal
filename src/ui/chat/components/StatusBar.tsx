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

  const perms = [];
  if (props.allowEdit) perms.push("edit");
  if (props.allowRun) perms.push("run");
  const permStr = perms.length > 0 ? `[${perms.join(", ")}]` : "[read-only]";

  return (
    <Box justifyContent="space-between" marginTop={1}>
      <Box>
        <Text color="cyanBright">⚙ </Text>
        <Text color="white">{props.providerLabel}</Text>
        {props.totalTokens ? (
          <Text color="yellowBright">
            <Text color={THEME.subtle}> · </Text>
            {props.totalTokens.toLocaleString()} tokens
          </Text>
        ) : null}
      </Box>
      <Box>
        <Text color={perms.length > 0 ? THEME.ok : THEME.hint}>{permStr}</Text>
        <Text color={THEME.subtle}> · </Text>
        <Text color="blueBright">{rootName}</Text>
      </Box>
    </Box>
  );
}
