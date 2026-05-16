import { z } from "zod";
import type { ToolSpec } from "../../types";
import { ensureParentDir, resolveInWorkspace } from "../../../infra/fs";

const inputSchema = z.object({
  path: z.string().min(1),
  content: z.string(),
  create: z.boolean().optional().default(true),
});

export const editFileTool: ToolSpec<
  z.infer<typeof inputSchema>,
  { ok: true; bytesWritten: number; content: string } | { ok: false; error: string }
> = {
  name: "editFile",
  description: "Write a UTF-8 text file in the workspace",
  inputSchema,
  permission: { kind: "confirm" },
  async execute(input, ctx) {
    if (!ctx.allowEdit) {
      return { 
        ok: false, 
        error: "Editing is disabled by policy. Please run crystal with --allow-edit or set CRYSTAL_ALLOW_EDIT=true to enable." 
      };
    }
    const abs = resolveInWorkspace(ctx.workspaceRoot, input.path);
    await ensureParentDir(abs);
    await Bun.write(abs, input.content);
    const bytesWritten = Buffer.byteLength(input.content, "utf8");
    return { ok: true, bytesWritten, content: input.content };
  },
};
