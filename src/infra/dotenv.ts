import fs from "node:fs/promises";
import path from "node:path";

export async function loadDotEnv(params?: { cwd?: string; filename?: string }): Promise<void> {
  const cwd = params?.cwd ?? process.cwd();
  const filename = params?.filename ?? ".env";
  const filePath = path.join(cwd, filename);

  let text: string;
  try {
    text = await fs.readFile(filePath, "utf8");
  } catch {
    return;
  }

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith("#")) continue;

    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (!key) continue;

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) process.env[key] = value;
  }
}
