import React from "react";
import { Box, Text } from "ink";
import type { ChatItem } from "../types";
import { MessageRow } from "./MessageRow";

export function MessageList(props: { items: ChatItem[]; width: number; height?: number }) {
  const slice = props.height ? Math.max(1, props.height) : 200;
  const visible = props.items.slice(-slice);

  return (
    <Box flexDirection="column">
      {visible.map((it, i) => {
        const next = i + 1 < visible.length ? visible[i + 1] : null;
        const needsGap = Boolean(next) && !(it.kind === "meta" && next?.kind === "meta");
        return (
          <Box key={i} flexDirection="column">
            <MessageRow item={it} width={props.width} />
            {needsGap ? <Text>{" "}</Text> : null}
          </Box>
        );
      })}
    </Box>
  );
}
