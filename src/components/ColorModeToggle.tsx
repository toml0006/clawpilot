"use client";

import { type ReactNode, useEffect, useState } from "react";
import { useTheme, type ColorMode } from "@/lib/theme";

const modes: { value: ColorMode; label: string; icon: ReactNode }[] = [
  {
    value: "light",
    label: "Light",
    icon: (
      <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="8" cy="8" r="3" />
        <path d="M8 1.5v1M8 13.5v1M1.5 8h1M13.5 8h1M3.4 3.4l.7.7M11.9 11.9l.7.7M3.4 12.6l.7-.7M11.9 4.1l.7-.7" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    value: "system",
    label: "Auto",
    icon: (
      <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="3" width="12" height="9" rx="1.5" />
        <path d="M5.5 14.5h5M8 12v2.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    value: "dark",
    label: "Dark",
    icon: (
      <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M13.5 9.5a5.5 5.5 0 0 1-7-7 5.5 5.5 0 1 0 7 7z" />
      </svg>
    ),
  },
];

export function ColorModeToggle() {
  const { colorMode, setColorMode } = useTheme();
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  return (
    <div className="flex items-center rounded-themed bg-surface-alt p-0.5 gap-0.5">
      {modes.map((m) => {
        const active = mounted && colorMode === m.value;
        return (
          <button
            key={m.value}
            onClick={() => setColorMode(m.value)}
            title={m.label}
            className={`flex flex-1 items-center justify-center gap-1 rounded-themed px-2 py-1.5 text-xs font-medium transition-all ${
              active
                ? "bg-surface text-ink shadow-themed"
                : "text-ink-3 hover:text-ink-2"
            }`}
          >
            {m.icon}
            <span>{m.label}</span>
          </button>
        );
      })}
    </div>
  );
}
