import React from "react";
import { Box, Text } from "ink";
import { THEME } from "../theme";

export function InputPanel(props: { value: string; busy: boolean; spinner: string }) {
  const placeholder = props.busy ? "Working…" : "Type your message or @path/to/file";
  const text = props.value.length ? props.value : placeholder;

  return (
    <Box borderStyle="round" borderColor={THEME.brand} paddingX={1}>
      <Box width={2}>
        <Text color={props.busy ? THEME.warn : THEME.brand}>{props.busy ? props.spinner : ">"}</Text>
      </Box>
      <Text dimColor={!props.value.length} wrap="wrap">
        {text}
      </Text>
    </Box>
  );
}
