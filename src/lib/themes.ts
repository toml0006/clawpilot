export type ThemeTokens = {
  bg: string; surface: string; surfaceHover: string; surfaceAlt: string;
  header: string; overlay: string;
  border: string; borderHover: string; ring: string;
  text: string; textSecondary: string; textMuted: string; textInverse: string;
  accent: string; accentHover: string; accentText: string;
  catBg: string; catText: string;
  pri0Bg: string; pri0Text: string;
  pri1Bg: string; pri1Text: string;
  pri2Bg: string; pri2Text: string;
  pri3Bg: string; pri3Text: string;
  statusDraft: string; statusReady: string; statusCliff: string;
  statusWaiting: string; statusDone: string;
  danger: string; dangerBg: string; dangerText: string; success: string;
  fontHeading: string; fontBody: string; fontMono: string;
  radius: string; radiusLg: string; borderWidth: string;
  shadow: string; shadowLg: string;
};

export type ThemeId = "modern" | "memphis" | "geocities" | "terminal" | "art-deco" | "wabi-sabi";

export type ThemeMeta = {
  id: ThemeId;
  name: string;
  description: string;
  colors: string[];
};

export const THEME_LIST: ThemeMeta[] = [
  { id: "modern", name: "Modern", description: "Clean 2026 SaaS aesthetic", colors: ["#09090b", "#3b82f6", "#22c55e", "#f59e0b", "#fafafa"] },
  { id: "memphis", name: "Memphis", description: "Bold post-modern geometry", colors: ["#FF6B9D", "#4ECDC4", "#FFE66D", "#FF6B6B", "#2C2C54"] },
  { id: "geocities", name: "Geocities", description: "Peak 1997 web nostalgia", colors: ["#00FF00", "#FF00FF", "#FFFF00", "#00FFFF", "#000000"] },
  { id: "terminal", name: "Terminal", description: "Green phosphor CRT", colors: ["#00FF41", "#008F11", "#003B00", "#0D0208", "#00FF41"] },
  { id: "art-deco", name: "Art Deco", description: "1920s luxury gold & navy", colors: ["#C9A84C", "#0A1628", "#F5E6C8", "#1A3A5C", "#8B7536"] },
  { id: "wabi-sabi", name: "Wabi-Sabi", description: "Japanese ink & paper", colors: ["#2C2C2C", "#C45D3A", "#7D8C6E", "#F7F3EB", "#9C9585"] },
];

const mono = "'Fira Code', monospace";

export const themes: Record<ThemeId, { light: ThemeTokens; dark: ThemeTokens }> = {
  modern: {
    light: {
      bg: "#f8fafc", surface: "#ffffff", surfaceHover: "#f1f5f9", surfaceAlt: "#f1f5f9",
      header: "#ffffff", overlay: "rgba(0,0,0,0.2)",
      border: "#e2e8f0", borderHover: "#cbd5e1", ring: "#93c5fd",
      text: "#0f172a", textSecondary: "#475569", textMuted: "#94a3b8", textInverse: "#ffffff",
      accent: "#3b82f6", accentHover: "#2563eb", accentText: "#ffffff",
      catBg: "#eff6ff", catText: "#1d4ed8",
      pri0Bg: "#f1f5f9", pri0Text: "#64748b",
      pri1Bg: "#fefce8", pri1Text: "#a16207",
      pri2Bg: "#fff7ed", pri2Text: "#c2410c",
      pri3Bg: "#fef2f2", pri3Text: "#dc2626",
      statusDraft: "#94a3b8", statusReady: "#3b82f6", statusCliff: "#f59e0b",
      statusWaiting: "#a855f7", statusDone: "#22c55e",
      danger: "#dc2626", dangerBg: "#fef2f2", dangerText: "#dc2626", success: "#22c55e",
      fontHeading: "'Bricolage Grotesque', sans-serif", fontBody: "'Albert Sans', sans-serif", fontMono: mono,
      radius: "8px", radiusLg: "12px", borderWidth: "1px",
      shadow: "0 1px 3px rgba(0,0,0,0.08)", shadowLg: "0 10px 25px rgba(0,0,0,0.1)",
    },
    dark: {
      bg: "#09090b", surface: "#111113", surfaceHover: "#1c1c1f", surfaceAlt: "#18181b",
      header: "#111113", overlay: "rgba(0,0,0,0.5)",
      border: "#27272a", borderHover: "#3f3f46", ring: "#1d4ed8",
      text: "#fafafa", textSecondary: "#a1a1aa", textMuted: "#71717a", textInverse: "#09090b",
      accent: "#3b82f6", accentHover: "#60a5fa", accentText: "#ffffff",
      catBg: "rgba(59,130,246,0.1)", catText: "#60a5fa",
      pri0Bg: "rgba(148,163,184,0.1)", pri0Text: "#94a3b8",
      pri1Bg: "rgba(245,158,11,0.1)", pri1Text: "#fbbf24",
      pri2Bg: "rgba(249,115,22,0.1)", pri2Text: "#fb923c",
      pri3Bg: "rgba(239,68,68,0.1)", pri3Text: "#f87171",
      statusDraft: "#71717a", statusReady: "#3b82f6", statusCliff: "#f59e0b",
      statusWaiting: "#a855f7", statusDone: "#22c55e",
      danger: "#ef4444", dangerBg: "rgba(239,68,68,0.1)", dangerText: "#f87171", success: "#22c55e",
      fontHeading: "'Bricolage Grotesque', sans-serif", fontBody: "'Albert Sans', sans-serif", fontMono: mono,
      radius: "8px", radiusLg: "12px", borderWidth: "1px",
      shadow: "0 1px 3px rgba(0,0,0,0.3)", shadowLg: "0 10px 25px rgba(0,0,0,0.5)",
    },
  },

  memphis: {
    light: {
      bg: "#F5F0EB", surface: "#FAFAFA", surfaceHover: "#F0EBE5", surfaceAlt: "#EDE8E2",
      header: "#FAFAFA", overlay: "rgba(0,0,0,0.25)",
      border: "#1a1a2e", borderHover: "#2C2C54", ring: "#FF6B9D",
      text: "#1a1a2e", textSecondary: "#4a4a6a", textMuted: "#8888a0", textInverse: "#FAFAFA",
      accent: "#FF6B9D", accentHover: "#e8558a", accentText: "#ffffff",
      catBg: "#4ECDC4", catText: "#1a1a2e",
      pri0Bg: "#eee", pri0Text: "#888",
      pri1Bg: "#FFE66D", pri1Text: "#6a5a00",
      pri2Bg: "#FF6B6B", pri2Text: "#ffffff",
      pri3Bg: "#FF6B9D", pri3Text: "#ffffff",
      statusDraft: "#aaa", statusReady: "#4ECDC4", statusCliff: "#FF6B9D",
      statusWaiting: "#FFE66D", statusDone: "#95E1D3",
      danger: "#FF6B6B", dangerBg: "#fff0f0", dangerText: "#cc3333", success: "#95E1D3",
      fontHeading: "'Bungee', sans-serif", fontBody: "'Lexend', sans-serif", fontMono: mono,
      radius: "0px", radiusLg: "0px", borderWidth: "3px",
      shadow: "none", shadowLg: "none",
    },
    dark: {
      bg: "#1a1a2e", surface: "#2a2a4e", surfaceHover: "#33335a", surfaceAlt: "#242444",
      header: "#2a2a4e", overlay: "rgba(0,0,0,0.5)",
      border: "rgba(250,250,250,0.25)", borderHover: "rgba(250,250,250,0.4)", ring: "#FF6B9D",
      text: "#fafafa", textSecondary: "#c8c8e0", textMuted: "#8888aa", textInverse: "#1a1a2e",
      accent: "#FF6B9D", accentHover: "#ff8ab5", accentText: "#ffffff",
      catBg: "rgba(78,205,196,0.2)", catText: "#4ECDC4",
      pri0Bg: "rgba(255,255,255,0.06)", pri0Text: "#8888aa",
      pri1Bg: "rgba(255,230,109,0.15)", pri1Text: "#FFE66D",
      pri2Bg: "rgba(255,107,107,0.2)", pri2Text: "#FF6B6B",
      pri3Bg: "rgba(255,107,157,0.2)", pri3Text: "#FF6B9D",
      statusDraft: "#8888aa", statusReady: "#4ECDC4", statusCliff: "#FF6B9D",
      statusWaiting: "#FFE66D", statusDone: "#95E1D3",
      danger: "#FF6B6B", dangerBg: "rgba(255,107,107,0.15)", dangerText: "#FF6B6B", success: "#95E1D3",
      fontHeading: "'Bungee', sans-serif", fontBody: "'Lexend', sans-serif", fontMono: mono,
      radius: "0px", radiusLg: "0px", borderWidth: "3px",
      shadow: "none", shadowLg: "none",
    },
  },

  geocities: {
    light: {
      bg: "#c0c0c0", surface: "#ffffff", surfaceHover: "#e8e8e8", surfaceAlt: "#d4d4d4",
      header: "#000080", overlay: "rgba(0,0,0,0.4)",
      border: "#808080", borderHover: "#666666", ring: "#0000ff",
      text: "#000000", textSecondary: "#333333", textMuted: "#666666", textInverse: "#ffffff",
      accent: "#0000ff", accentHover: "#0000cc", accentText: "#ffffff",
      catBg: "#ffff00", catText: "#000000",
      pri0Bg: "#c0c0c0", pri0Text: "#444444",
      pri1Bg: "#ffff00", pri1Text: "#666600",
      pri2Bg: "#ff6600", pri2Text: "#ffffff",
      pri3Bg: "#ff0000", pri3Text: "#ffffff",
      statusDraft: "#808080", statusReady: "#0000ff", statusCliff: "#ff0000",
      statusWaiting: "#ff6600", statusDone: "#008000",
      danger: "#ff0000", dangerBg: "#ffe0e0", dangerText: "#cc0000", success: "#008000",
      fontHeading: "'Press Start 2P', monospace", fontBody: "'Comic Sans MS', 'Chalkboard SE', cursive", fontMono: "'Courier New', monospace",
      radius: "0px", radiusLg: "0px", borderWidth: "2px",
      shadow: "2px 2px 0 #808080", shadowLg: "3px 3px 0 #808080",
    },
    dark: {
      bg: "#000011", surface: "#000022", surfaceHover: "#001133", surfaceAlt: "#000033",
      header: "#220022", overlay: "rgba(0,0,0,0.6)",
      border: "#444444", borderHover: "#666666", ring: "#00ccff",
      text: "#00ff00", textSecondary: "#00cc00", textMuted: "#008800", textInverse: "#000000",
      accent: "#00ccff", accentHover: "#33ddff", accentText: "#000000",
      catBg: "rgba(255,0,255,0.2)", catText: "#ff00ff",
      pri0Bg: "rgba(255,255,255,0.05)", pri0Text: "#666666",
      pri1Bg: "rgba(255,255,0,0.15)", pri1Text: "#ffff00",
      pri2Bg: "rgba(255,102,0,0.2)", pri2Text: "#ff6600",
      pri3Bg: "rgba(255,0,0,0.2)", pri3Text: "#ff0000",
      statusDraft: "#666666", statusReady: "#00ff00", statusCliff: "#ff0000",
      statusWaiting: "#ffff00", statusDone: "#00ccff",
      danger: "#ff0000", dangerBg: "rgba(255,0,0,0.15)", dangerText: "#ff4444", success: "#00ff00",
      fontHeading: "'Press Start 2P', monospace", fontBody: "'Comic Sans MS', 'Chalkboard SE', cursive", fontMono: "'Courier New', monospace",
      radius: "0px", radiusLg: "0px", borderWidth: "2px",
      shadow: "none", shadowLg: "none",
    },
  },

  terminal: {
    light: {
      bg: "#f0f4f0", surface: "#fafefa", surfaceHover: "#e8f0e8", surfaceAlt: "#e4ece4",
      header: "#dfe8df", overlay: "rgba(0,0,0,0.2)",
      border: "#b8ccb8", borderHover: "#90a890", ring: "#2a8a2a",
      text: "#1a3a1a", textSecondary: "#3a6a3a", textMuted: "#6a9a6a", textInverse: "#f0f4f0",
      accent: "#1a8a1a", accentHover: "#158015", accentText: "#ffffff",
      catBg: "rgba(26,138,26,0.1)", catText: "#1a6a1a",
      pri0Bg: "rgba(0,0,0,0.04)", pri0Text: "#6a9a6a",
      pri1Bg: "rgba(26,138,26,0.08)", pri1Text: "#1a6a1a",
      pri2Bg: "rgba(200,160,0,0.1)", pri2Text: "#8a6a00",
      pri3Bg: "rgba(200,50,50,0.1)", pri3Text: "#8a2020",
      statusDraft: "#6a9a6a", statusReady: "#1a8a1a", statusCliff: "#aa8a00",
      statusWaiting: "#8a6a00", statusDone: "#2a6a2a",
      danger: "#8a2020", dangerBg: "rgba(200,50,50,0.08)", dangerText: "#8a2020", success: "#1a8a1a",
      fontHeading: "'Space Mono', monospace", fontBody: "'Space Mono', monospace", fontMono: "'Space Mono', monospace",
      radius: "0px", radiusLg: "0px", borderWidth: "1px",
      shadow: "none", shadowLg: "none",
    },
    dark: {
      bg: "#0d0208", surface: "#0a1a0a", surfaceHover: "#0f220f", surfaceAlt: "#0d1a0d",
      header: "#001a00", overlay: "rgba(0,0,0,0.6)",
      border: "#003b00", borderHover: "#005500", ring: "#00ff41",
      text: "#00ff41", textSecondary: "#008f11", textMuted: "#005500", textInverse: "#0d0208",
      accent: "#00ff41", accentHover: "#33ff66", accentText: "#0d0208",
      catBg: "rgba(0,255,65,0.08)", catText: "#00ff41",
      pri0Bg: "rgba(0,255,65,0.04)", pri0Text: "#005500",
      pri1Bg: "rgba(0,255,65,0.08)", pri1Text: "#008f11",
      pri2Bg: "rgba(255,176,0,0.12)", pri2Text: "#ffb000",
      pri3Bg: "rgba(255,50,50,0.12)", pri3Text: "#ff3333",
      statusDraft: "#005500", statusReady: "#00ff41", statusCliff: "#ffb000",
      statusWaiting: "#ffb000", statusDone: "#008f11",
      danger: "#ff3333", dangerBg: "rgba(255,50,50,0.1)", dangerText: "#ff3333", success: "#00ff41",
      fontHeading: "'Space Mono', monospace", fontBody: "'Space Mono', monospace", fontMono: "'Space Mono', monospace",
      radius: "0px", radiusLg: "0px", borderWidth: "1px",
      shadow: "none", shadowLg: "none",
    },
  },

  "art-deco": {
    light: {
      bg: "#faf6ee", surface: "#ffffff", surfaceHover: "#f5f0e5", surfaceAlt: "#f0ead8",
      header: "#ffffff", overlay: "rgba(0,0,0,0.2)",
      border: "#d4c5a0", borderHover: "#b8a880", ring: "#8b6914",
      text: "#0a1628", textSecondary: "#3a4a5a", textMuted: "#7a8a9a", textInverse: "#faf6ee",
      accent: "#8b6914", accentHover: "#7a5a0a", accentText: "#ffffff",
      catBg: "rgba(139,105,20,0.08)", catText: "#8b6914",
      pri0Bg: "rgba(0,0,0,0.03)", pri0Text: "#7a8a9a",
      pri1Bg: "rgba(139,105,20,0.08)", pri1Text: "#8b6914",
      pri2Bg: "rgba(180,100,20,0.1)", pri2Text: "#8a4a00",
      pri3Bg: "rgba(180,50,50,0.08)", pri3Text: "#8a2020",
      statusDraft: "#7a8a9a", statusReady: "#1a6b5a", statusCliff: "#8b6914",
      statusWaiting: "#6a5a8a", statusDone: "#1a6b5a",
      danger: "#8a2020", dangerBg: "rgba(180,50,50,0.06)", dangerText: "#8a2020", success: "#1a6b5a",
      fontHeading: "'Cinzel Decorative', serif", fontBody: "'Sorts Mill Goudy', Georgia, serif", fontMono: mono,
      radius: "2px", radiusLg: "4px", borderWidth: "1px",
      shadow: "0 1px 4px rgba(0,0,0,0.06)", shadowLg: "0 8px 24px rgba(0,0,0,0.08)",
    },
    dark: {
      bg: "#0a1628", surface: "#142240", surfaceHover: "#1a2d50", surfaceAlt: "#101e38",
      header: "#0e1c32", overlay: "rgba(0,0,0,0.5)",
      border: "rgba(201,168,76,0.2)", borderHover: "rgba(201,168,76,0.35)", ring: "#c9a84c",
      text: "#f5e6c8", textSecondary: "#c8b898", textMuted: "#8a7a60", textInverse: "#0a1628",
      accent: "#c9a84c", accentHover: "#ddb85a", accentText: "#0a1628",
      catBg: "rgba(201,168,76,0.1)", catText: "#c9a84c",
      pri0Bg: "rgba(255,255,255,0.03)", pri0Text: "#8a7a60",
      pri1Bg: "rgba(201,168,76,0.1)", pri1Text: "#c9a84c",
      pri2Bg: "rgba(220,140,40,0.12)", pri2Text: "#e0a040",
      pri3Bg: "rgba(212,87,74,0.12)", pri3Text: "#d4574a",
      statusDraft: "#8a7a60", statusReady: "#1a6b5a", statusCliff: "#c9a84c",
      statusWaiting: "#8a7ab0", statusDone: "#2a9b85",
      danger: "#d4574a", dangerBg: "rgba(212,87,74,0.1)", dangerText: "#d4574a", success: "#2a9b85",
      fontHeading: "'Cinzel Decorative', serif", fontBody: "'Sorts Mill Goudy', Georgia, serif", fontMono: mono,
      radius: "2px", radiusLg: "4px", borderWidth: "1px",
      shadow: "0 1px 4px rgba(0,0,0,0.2)", shadowLg: "0 8px 24px rgba(0,0,0,0.3)",
    },
  },

  "wabi-sabi": {
    light: {
      bg: "#f7f3eb", surface: "rgba(255,255,255,0.6)", surfaceHover: "rgba(255,255,255,0.8)", surfaceAlt: "#efe9de",
      header: "rgba(255,255,255,0.7)", overlay: "rgba(0,0,0,0.15)",
      border: "#e0d8c8", borderHover: "#c8c0b0", ring: "#c45d3a",
      text: "#2c2c2c", textSecondary: "#5a5a5a", textMuted: "#9c9585", textInverse: "#f7f3eb",
      accent: "#c45d3a", accentHover: "#a84e30", accentText: "#ffffff",
      catBg: "rgba(125,140,110,0.12)", catText: "#5a6a4e",
      pri0Bg: "rgba(0,0,0,0.03)", pri0Text: "#9c9585",
      pri1Bg: "rgba(125,140,110,0.1)", pri1Text: "#5a6a4e",
      pri2Bg: "rgba(196,93,58,0.08)", pri2Text: "#a84e30",
      pri3Bg: "rgba(196,93,58,0.14)", pri3Text: "#8a3a20",
      statusDraft: "#9c9585", statusReady: "#7d8c6e", statusCliff: "#c45d3a",
      statusWaiting: "#a08860", statusDone: "#5a7a50",
      danger: "#8a3a20", dangerBg: "rgba(196,93,58,0.06)", dangerText: "#8a3a20", success: "#5a7a50",
      fontHeading: "'Shippori Mincho', serif", fontBody: "'Zen Kaku Gothic New', sans-serif", fontMono: mono,
      radius: "2px", radiusLg: "4px", borderWidth: "1px",
      shadow: "0 2px 8px rgba(0,0,0,0.04)", shadowLg: "0 8px 24px rgba(0,0,0,0.06)",
    },
    dark: {
      bg: "#1a1917", surface: "#242320", surfaceHover: "#2e2d28", surfaceAlt: "#201f1c",
      header: "#1e1d1a", overlay: "rgba(0,0,0,0.5)",
      border: "#3a3835", borderHover: "#4a4845", ring: "#c45d3a",
      text: "#e8e4dc", textSecondary: "#b0a898", textMuted: "#78726a", textInverse: "#1a1917",
      accent: "#c45d3a", accentHover: "#d06a45", accentText: "#ffffff",
      catBg: "rgba(125,140,110,0.12)", catText: "#8a9a78",
      pri0Bg: "rgba(255,255,255,0.03)", pri0Text: "#78726a",
      pri1Bg: "rgba(125,140,110,0.1)", pri1Text: "#8a9a78",
      pri2Bg: "rgba(196,93,58,0.12)", pri2Text: "#d07050",
      pri3Bg: "rgba(196,93,58,0.18)", pri3Text: "#e07858",
      statusDraft: "#78726a", statusReady: "#7d8c6e", statusCliff: "#c45d3a",
      statusWaiting: "#a08860", statusDone: "#6a8a5a",
      danger: "#c45d3a", dangerBg: "rgba(196,93,58,0.1)", dangerText: "#d07050", success: "#6a8a5a",
      fontHeading: "'Shippori Mincho', serif", fontBody: "'Zen Kaku Gothic New', sans-serif", fontMono: mono,
      radius: "2px", radiusLg: "4px", borderWidth: "1px",
      shadow: "0 2px 8px rgba(0,0,0,0.15)", shadowLg: "0 8px 24px rgba(0,0,0,0.25)",
    },
  },
};
