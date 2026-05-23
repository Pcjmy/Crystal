import { z } from "zod";
import type { ToolSpec } from "../../types";
import { resolveInWorkspace } from "../../../infra/fs";

const inputSchema = z.object({
  path: z.string().min(1),
  maxBytes: z.number().int().positive().optional().default(200_000),
});

export const readFileTool: ToolSpec<
  z.infer<typeof inputSchema>,
  { ok: true; path: string; content: string } | { ok: false; path: string; error: string }
> = {
  name: "readFile",
  description: "Read a UTF-8 text file from the workspace",
  inputSchema,
  permission: { kind: "auto" },
  async execute(input, ctx) {
    const abs = resolveInWorkspace(ctx.workspaceRoot, input.path);
    const file = Bun.file(abs);
    const exists = await file.exists();
    if (!exists) return { ok: false, path: input.path, error: "File not found" };
    const buf = await file.arrayBuffer();
    const sliced = buf.byteLength > input.maxBytes ? buf.slice(0, input.maxBytes) : buf;
    const content = new TextDecoder().decode(sliced);
    return { ok: true, path: input.path, content };
  },
};
