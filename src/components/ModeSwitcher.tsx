"use client";

import { useLanguage } from "@/lib/i18n";

export type Mode = "hands" | "face" | "faceId";

const MODES: { mode: Mode; labelKey: string }[] = [
  { mode: "hands", labelKey: "mode.hands" },
  { mode: "face", labelKey: "mode.face" },
  { mode: "faceId", labelKey: "mode.faceId" },
];

export default function ModeSwitcher({ mode, onChange }: { mode: Mode; onChange: (mode: Mode) => void }) {
  const { t } = useLanguage();

  return (
    <div className="flex items-center gap-1 rounded-full border border-border bg-surface p-1 text-sm font-medium">
      {MODES.map(({ mode: m, labelKey }) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className={`px-4 py-1.5 rounded-full transition-colors ${
            mode === m ? "gradient-brand text-black" : "text-foreground-muted hover:text-foreground"
          }`}
        >
          {t(labelKey)}
        </button>
      ))}
    </div>
  );
}
