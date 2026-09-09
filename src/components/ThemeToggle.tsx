"use client";

import { useTheme, type ThemeMode } from "@/lib/theme";
import { useLanguage } from "@/lib/i18n";

const OPTIONS: { mode: ThemeMode; icon: string; labelKey: string }[] = [
  { mode: "light", icon: "☀️", labelKey: "theme.light" },
  { mode: "dark", icon: "🌙", labelKey: "theme.dark" },
  { mode: "system", icon: "💻", labelKey: "theme.system" },
];

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const { t } = useLanguage();

  return (
    <div className="flex items-center rounded-full border border-border bg-surface p-1">
      {OPTIONS.map(({ mode, icon, labelKey }) => (
        <button
          key={mode}
          onClick={() => setTheme(mode)}
          title={t(labelKey)}
          aria-label={t(labelKey)}
          className={`h-8 w-8 flex items-center justify-center rounded-full text-sm transition-colors ${
            theme === mode ? "gradient-brand" : "hover:bg-surface-muted"
          }`}
        >
          {icon}
        </button>
      ))}
    </div>
  );
}
