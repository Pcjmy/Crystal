import React, { useMemo } from "react";
import { Box, Text } from "ink";
import { renderAsciiLogo, renderPixelText, splitGradient } from "../pixel";

export function Banner(props: { title: string; width: number }) {
  const lines = useMemo(() => {
    const maxAllowed = Math.max(10, props.width - 10);
    const fits = (candidate: string[]) => {
      if (candidate.length === 0) return false;
      const w = candidate.reduce((m, l) => Math.max(m, Array.from(l).length), 0);
      return w <= maxAllowed;
    };

    const ascii = renderAsciiLogo(props.title, maxAllowed);
    if (ascii && fits(ascii)) return ascii;

    const quad = renderPixelText(props.title, { style: "quad" });
    if (fits(quad)) return quad;

    const block = renderPixelText(props.title, { style: "block5" });
    if (fits(block)) return block;

    return [];
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
