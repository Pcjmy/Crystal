import React from "react";
import { Box, Text } from "ink";

export function Tips() {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text dimColor>Tips for getting started:</Text>
      <Text dimColor>1. Ask questions, edit files, or run commands.</Text>
      <Text dimColor>2. Be specific for the best results.</Text>
      <Text dimColor>3. Press ? for help.</Text>
    </Box>
  );
}
