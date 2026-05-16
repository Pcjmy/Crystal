type Glyph5 = [string, string, string, string, string];

const PIXEL_FONT_5: Record<string, Glyph5> = {
  A: [" ███  ", "█   █ ", "█████ ", "█   █ ", "█   █ "],
  C: [" ████ ", "█     ", "█     ", "█     ", " ████ "],
  L: ["█     ", "█     ", "█     ", "█     ", "█████ "],
  R: ["████  ", "█   █ ", "████  ", "█  █  ", "█   █ "],
  S: [" ████ ", "█     ", " ███  ", "    █ ", "████  "],
  T: ["█████ ", "  █   ", "  █   ", "  █   ", "  █   "],
  Y: ["█   █ ", " █ █  ", "  █   ", "  █   ", "  █   "],
  " ": ["   ", "   ", "   ", "   ", "   "],
};

export function renderPixelText(text: string): string[] {
  const gap = " ";
  const upper = text.toUpperCase();
  const rows = ["", "", "", "", ""];

  for (const ch of upper) {
    const glyph = PIXEL_FONT_5[ch] ?? PIXEL_FONT_5[" "];
    for (let i = 0; i < rows.length; i++) rows[i] += glyph[i] + gap;
  }

  return rows.map((r) => r.replaceAll(/\s+$/g, ""));
}

export function splitGradient(line: string): Array<{ text: string; color: string }> {
  if (!line) return [];

  const segments = 15;
  const len = line.length;
  const chunkLen = Math.ceil(len / segments);
  const result: Array<{ text: string; color: string }> = [];

  const c1: [number, number, number] = [66, 133, 244];
  const c2: [number, number, number] = [161, 91, 181];

  for (let i = 0; i < segments; i++) {
    const text = line.slice(i * chunkLen, (i + 1) * chunkLen);
    if (!text) continue;

    const factor = segments > 1 ? i / (segments - 1) : 0;
    const r = Math.round(c1[0] + factor * (c2[0] - c1[0]));
    const g = Math.round(c1[1] + factor * (c2[1] - c1[1]));
    const b = Math.round(c1[2] + factor * (c2[2] - c1[2]));

    const hex = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
    result.push({ text, color: hex });
  }

  return result;
}
