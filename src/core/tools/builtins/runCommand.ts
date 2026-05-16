import { z } from "zod";
import type { ToolSpec } from "../../types";

const inputSchema = z.object({
  command: z.string().min(1),
  cwd: z.string().optional(),
  timeoutMs: z.number().int().positive().optional().default(20_000),
  maxOutputBytes: z.number().int().positive().optional().default(200_000),
});

export const runCommandTool: ToolSpec<
  z.infer<typeof inputSchema>,
  | { ok: boolean; exitCode: number; stdout: string; stderr: string }
  | { ok: false; error: string; stdout?: string; stderr?: string }
> = {
  name: "runCommand",
  description: "Run a shell command (guarded by policy)",
  inputSchema,
  permission: { kind: "confirm" },
  async execute(input, ctx) {
    if (!ctx.allowRun) return { ok: false, error: "Command execution is disabled by policy" };

    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), input.timeoutMs);
    const combinedSignal = anySignal([ctx.signal, controller.signal]);

    try {
      const proc = Bun.spawn(["powershell", "-NoProfile", "-Command", input.command], {
        cwd: input.cwd ?? ctx.workspaceRoot,
        stdout: "pipe",
        stderr: "pipe",
        signal: combinedSignal,
      });

      const stdoutBuf = await readLimited(proc.stdout, input.maxOutputBytes);
      const stderrBuf = await readLimited(proc.stderr, input.maxOutputBytes);
      const exitCode = await proc.exited;

      return {
        ok: exitCode === 0,
        exitCode,
        stdout: new TextDecoder().decode(stdoutBuf),
        stderr: new TextDecoder().decode(stderrBuf),
      };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
    } finally {
      clearTimeout(t);
    }
  },
};

function anySignal(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  for (const s of signals) {
    if (s.aborted) return s;
    s.addEventListener("abort", onAbort, { once: true });
  }
  return controller.signal;
}

async function readLimited(stream: ReadableStream<Uint8Array> | null, maxBytes: number): Promise<Uint8Array> {
  if (!stream) return new Uint8Array();
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    const remaining = maxBytes - total;
    if (remaining <= 0) break;
    const slice = value.byteLength > remaining ? value.slice(0, remaining) : value;
    chunks.push(slice);
    total += slice.byteLength;
    if (total >= maxBytes) break;
  }

  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.byteLength;
  }
  return out;
}
