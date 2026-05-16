import crypto from "node:crypto";

export function createSessionId(now: Date = new Date()): string {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  const rand = crypto.randomUUID().split("-")[0];
  return `${yyyy}${mm}${dd}_${hh}${min}${ss}_${rand}`;
}
