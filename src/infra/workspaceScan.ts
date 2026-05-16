import path from "node:path";

const defaultIgnored = new Set([".git", "node_modules", ".crystal", "dist", "build", "coverage"]);

export async function listWorkspaceFiles(params: { workspaceRoot: string; maxFiles?: number }): Promise<string[]> {
  const out: string[] = [];
  const maxFiles = params.maxFiles ?? 50_000;

  const fs = await import("node:fs/promises");

  async function walkFs(dirAbs: string) {
    if (out.length >= maxFiles) return;
    const entries = await fs.readdir(dirAbs, { withFileTypes: true });
    for (const ent of entries) {
      if (out.length >= maxFiles) return;
      if (defaultIgnored.has(ent.name)) continue;
      const abs = path.join(dirAbs, ent.name);
      if (ent.isDirectory()) {
        await walkFs(abs);
      } else if (ent.isFile()) {
        out.push(abs);
      }
    }
  }

  await walkFs(params.workspaceRoot);
  return out;
}
