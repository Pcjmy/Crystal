import React, { useMemo } from "react";
import { Box, Text } from "ink";
import { renderPixelText, splitGradient } from "../pixel";

export function Banner(props: { title: string; width: number }) {
  const lines = useMemo(() => {
    const canRender = props.width >= 66;
    return canRender ? renderPixelText(props.title) : [];
  }, [props.title, props.width]);

  if (lines.length === 0) {
    return (
      <Box>
        <Text color="cyanBright">{props.title}</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {lines.map((line, i) => (
        <Box key={i}>
          {splitGradient(line).map((seg, j) => (
            <Text key={j} color={seg.color}>
              {seg.text}
            </Text>
          ))}
        </Box>
      ))}
    </Box>
  );
}
