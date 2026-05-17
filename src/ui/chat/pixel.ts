type Glyph5 = [string, string, string, string, string];

const PIXEL_FONT_5: Record<string, Glyph5> = {
  A: [" ▟▀▀▙ ", "▐▌  ▐▌", "▐▛▀▀▜▌", "▐▌  ▐▌", "▐▌  ▐▌"],
  C: [" ▟▀▀▙ ", "▐▌    ", "▐▌    ", "▐▌    ", " ▜▄▄▛ "],
  L: ["▐▌    ", "▐▌    ", "▐▌    ", "▐▌    ", "▐▙▄▄▄▖"],
  R: ["▐▛▀▀▙ ", "▐▌  ▐▌", "▐▛▀▀▘ ", "▐▌ ▜▙ ", "▐▌  ▐▌"],
  S: [" ▟▀▀▙ ", "▐▌    ", " ▜▀▀▙ ", "    ▐▌", " ▙▄▄▛ "],
  T: ["▟▀▀▀▀▙", "  ▐▌  ", "  ▐▌  ", "  ▐▌  ", "  ▐▌  "],
  Y: ["▐▌  ▐▌", " ▜▄▄▛ ", "  ▐▌  ", "  ▐▌  ", "  ▐▌  "],
  " ": ["      ", "      ", "      ", "      ", "      "],
};

type GlyphBitmap = {
  w: number;
  h: number;
  rows: string[];
};

const QUAD_BITMAP_FONT_8: Record<string, GlyphBitmap> = {
  A: {
    w: 8,
    h: 8,
    rows: [
      "00111100",
      "01100110",
      "11000011",
      "11111111",
      "11000011",
      "11000011",
      "11000011",
      "00000000",
    ],
  },
  C: {
    w: 8,
    h: 8,
    rows: [
      "00111110",
      "01100011",
      "11000000",
      "11000000",
      "11000000",
      "01100011",
      "00111110",
      "00000000",
    ],
  },
  L: {
    w: 8,
    h: 8,
    rows: [
      "11000000",
      "11000000",
      "11000000",
      "11000000",
      "11000000",
      "11000000",
      "11111110",
      "00000000",
    ],
  },
  R: {
    w: 8,
    h: 8,
    rows: [
      "11111100",
      "11000110",
      "11000110",
      "11111100",
      "11001100",
      "11000110",
      "11000110",
      "00000000",
    ],
  },
  S: {
    w: 8,
    h: 8,
    rows: [
      "01111110",
      "11000000",
      "01111100",
      "00000110",
      "00000110",
      "11000110",
      "01111100",
      "00000000",
    ],
  },
  T: {
    w: 8,
    h: 8,
    rows: [
      "11111111",
      "00111000",
      "00111000",
      "00111000",
      "00111000",
      "00111000",
      "00111000",
      "00000000",
    ],
  },
  Y: {
    w: 8,
    h: 8,
    rows: [
      "11000011",
      "01100110",
      "00111100",
      "00011000",
      "00011000",
      "00011000",
      "00011000",
      "00000000",
    ],
  },
  " ": {
    w: 8,
    h: 8,
    rows: [
      "00000000",
      "00000000",
      "00000000",
      "00000000",
      "00000000",
      "00000000",
      "00000000",
      "00000000",
    ],
  },
};

const QUADRANT_BY_MASK: string[] = [
  " ",
  "▗",
  "▖",
  "▄",
  "▝",
  "▐",
  "▞",
  "▟",
  "▘",
  "▚",
  "▌",
  "▙",
  "▀",
  "▜",
  "▛",
  "█",
];

function trimRightSpaces(s: string): string {
  return s.replaceAll(/\s+$/g, "");
}

const ASCII_LOGOS: Record<string, string[][]> = {
  CRYSTAL: [
    [
      " ██████╗██████╗ ██╗   ██╗███████╗████████╗ █████╗ ██╗     ",
      "██╔════╝██╔══██╗╚██╗ ██╔╝██╔════╝╚══██╔══╝██╔══██╗██║     ",
      "██║     ██████╔╝ ╚████╔╝ ███████╗   ██║   ███████║██║     ",
      "██║     ██╔══██╗  ╚██╔╝  ╚════██║   ██║   ██╔══██║██║     ",
      "╚██████╗██║  ██║   ██║   ███████║   ██║   ██║  ██║███████╗",
      " ╚═════╝╚═╝  ╚═╝   ╚═╝   ╚══════╝   ╚═╝   ╚═╝  ╚═╝╚══════╝",
    ],
  ],
};

export function renderAsciiLogo(title: string, maxWidth: number): string[] | null {
  const key = title.toUpperCase();
  const variants = ASCII_LOGOS[key];
  if (!variants) return null;

  const widthOf = (lines: string[]) => lines.reduce((m, l) => Math.max(m, Array.from(l).length), 0);
  const best = variants.reduce<string[] | null>((acc, lines) => {
    const w = widthOf(lines);
    if (w > maxWidth) return acc;
    if (!acc) return lines;
    return w > widthOf(acc) ? lines : acc;
  }, null);

  return best ? best.map(trimRightSpaces) : null;
}

function renderPixelTextBlock5(text: string): string[] {
  const gap = " ";
  const upper = text.toUpperCase();
  const rows = ["", "", "", "", ""];

  for (const ch of upper) {
    const glyph = PIXEL_FONT_5[ch] ?? PIXEL_FONT_5[" "];
    for (let i = 0; i < rows.length; i++) rows[i] += glyph[i] + gap;
  }

  return rows.map(trimRightSpaces);
}

function renderGlyphToQuadrants(glyph: GlyphBitmap): string[] {
  const outH = Math.floor(glyph.h / 2);
  const outW = Math.floor(glyph.w / 2);
  const lines: string[] = [];

  for (let oy = 0; oy < outH; oy++) {
    const y = oy * 2;
    let line = "";
    for (let ox = 0; ox < outW; ox++) {
      const x = ox * 2;
      const r0 = glyph.rows[y] ?? "";
      const r1 = glyph.rows[y + 1] ?? "";
      const tl = r0[x] === "1";
      const tr = r0[x + 1] === "1";
      const bl = r1[x] === "1";
      const br = r1[x + 1] === "1";
      const mask = (tl ? 8 : 0) | (tr ? 4 : 0) | (bl ? 2 : 0) | (br ? 1 : 0);
      line += QUADRANT_BY_MASK[mask] ?? " ";
    }
    lines.push(line);
  }

  return lines;
}

const QUAD_CACHE = new Map<string, string[]>();

function renderPixelTextQuad(text: string): string[] {
  const gap = " ";
  const upper = text.toUpperCase();
  const rows = ["", "", "", ""];

  for (const ch of upper) {
    const key = QUAD_BITMAP_FONT_8[ch] ? ch : " ";
    const cached = QUAD_CACHE.get(key);
    const glyphLines = cached ?? renderGlyphToQuadrants(QUAD_BITMAP_FONT_8[key]!);
    if (!cached) QUAD_CACHE.set(key, glyphLines);
    for (let i = 0; i < rows.length; i++) rows[i] += (glyphLines[i] ?? "") + gap;
  }

  return rows.map(trimRightSpaces);
}

export function renderPixelText(text: string, opts?: { style?: "quad" | "block5" }): string[] {
  const style = opts?.style ?? "block5";
  return style === "quad" ? renderPixelTextQuad(text) : renderPixelTextBlock5(text);
}

export function splitGradient(line: string): Array<{ text: string; color: string }> {
  const chars = Array.from(line);
  if (chars.length === 0) return [];

  const steps = 80;
  const c1: [number, number, number] = [66, 133, 244];
  const c2: [number, number, number] = [161, 91, 181];
  const c3: [number, number, number] = [255, 79, 163];

  const width = chars.length;
  const result: Array<{ text: string; color: string }> = [];

  const toHex = (rgb: [number, number, number]) =>
    `#${rgb[0].toString(16).padStart(2, "0")}${rgb[1].toString(16).padStart(2, "0")}${rgb[2]
      .toString(16)
      .padStart(2, "0")}`;

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  const colorAt = (x: number): string => {
    const t = width > 1 ? x / (width - 1) : 0;
    const segT = t <= 0.5 ? t / 0.5 : (t - 0.5) / 0.5;
    const qt = Math.round(segT * (steps - 1)) / (steps - 1);
    const from = t <= 0.5 ? c1 : c2;
    const to = t <= 0.5 ? c2 : c3;

    const r = Math.round(lerp(from[0], to[0], qt));
    const g = Math.round(lerp(from[1], to[1], qt));
    const b = Math.round(lerp(from[2], to[2], qt));
    return toHex([r, g, b]);
  };

  let currentColor = colorAt(0);
  let currentText = "";

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i] ?? "";
    const color = colorAt(i);
    if (color !== currentColor && currentText) {
      result.push({ text: currentText, color: currentColor });
      currentText = "";
      currentColor = color;
    }
    currentText += ch;
  }

  if (currentText) result.push({ text: currentText, color: currentColor });
  return result;
}
