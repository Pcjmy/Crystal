import React from "react";
import { Box } from "ink";
import type { ChatItem } from "../types";
import { MessageRow } from "./MessageRow";

export function MessageList(props: { items: ChatItem[]; width: number; height?: number }) {
  const slice = props.height ? Math.max(1, props.height) : 200;
  const visible = props.items.slice(-slice);

  return (
    <Box flexDirection="column">
      {visible.map((it, i) => (
        <MessageRow key={i} item={it} width={props.width} />
      ))}
    </Box>
  );
}
