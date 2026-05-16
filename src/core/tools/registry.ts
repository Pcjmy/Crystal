import type { ToolRegistry, ToolSpec } from "../types";

export function createToolRegistry(tools: Array<ToolSpec<any, any>>): ToolRegistry {
  const map = new Map<string, ToolSpec<any, any>>();
  for (const t of tools) map.set(t.name, t);

  return {
    list() {
      return tools.map((t) => ({ name: t.name, description: t.description }));
    },
    get(name) {
      return map.get(name);
    },
  };
}
