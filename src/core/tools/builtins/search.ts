import path from "node:path";
import { z } from "zod";
import type { ToolSpec } from "../../types";
import { listWorkspaceFiles } from "../../../infra/workspaceScan";

const inputSchema = z.object({
  query: z.string().min(1),
  maxResults: z.number().int().positive().optional().default(50),
  fileGlobs: z.array(z.string()).optional(),
});

type Match = { path: string; line: number; text: string };

function looksTextFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return (
    ext === ".ts" ||
    ext === ".tsx" ||
    ext === ".js" ||
    ext === ".jsx" ||
    ext === ".json" ||
    ext === ".md" ||
    ext === ".txt" ||
    ext === ".yml" ||
    ext === ".yaml"
  );
}

export const searchTool: ToolSpec<
  z.infer<typeof inputSchema>,
  { ok: true; matches: Match[] } | { ok: false; error: string }
> = {
  name: "search",
  description: "Search for a string in workspace files",
  inputSchema,
  permission: { kind: "auto" },
  async execute(input, ctx) {
    const files = await listWorkspaceFiles({ workspaceRoot: ctx.workspaceRoot });
    const matches: Match[] = [];
    const q = input.query;

    for (const abs of files) {
      if (matches.length >= input.maxResults) break;
      if (!looksTextFile(abs)) continue;
      let text: string;
      try {
        text = await Bun.file(abs).text();
      } catch {
        continue;
      }
      if (!text.includes(q)) continue;

      const rel = path.relative(ctx.workspaceRoot, abs);
      const lines = text.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (matches.length >= input.maxResults) break;
        if (!lines[i]!.includes(q)) continue;
        matches.push({ path: rel, line: i + 1, text: lines[i]!.slice(0, 300) });
      }
    }

    return { ok: true, matches };
  },
};
