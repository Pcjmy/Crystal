import path from "node:path";
import fs from "node:fs/promises";
import { ensureParentDir } from "./fs";

export type JsonValue = null | boolean | number | string | JsonValue[] | { [k: string]: JsonValue };

export type LogEntry = {
  at: string;
  sessionId: string;
  seq: number;
  event: string;
  turn?: number;
  data?: JsonValue;
};

export type SessionLogger = {
  write(entry: { event: string; turn?: number; data?: JsonValue }): Promise<void>;
};

export function createSessionLogger(params: { workspaceRoot: string; sessionId: string }): SessionLogger {
  const filePath = path.join(params.workspaceRoot, ".crystal", "sessions", `${params.sessionId}.jsonl`);
  let seq = 0;

  return {
    async write(entry) {
      await ensureParentDir(filePath);
      const record: LogEntry = {
        at: new Date().toISOString(),
        sessionId: params.sessionId,
        seq: (seq += 1),
        event: entry.event,
        turn: entry.turn,
        data: entry.data,
      };
      await fs.appendFile(filePath, `${JSON.stringify(record)}\n`, "utf8");
    },
  };
}
