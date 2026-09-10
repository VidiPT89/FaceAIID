"use client";

import { useDebugMode } from "@/lib/debugMode";
import { useLanguage } from "@/lib/i18n";

export default function DebugModeToggle() {
  const { debugMode, toggle } = useDebugMode();
  const { t } = useLanguage();

  return (
    <button
      onClick={toggle}
      title={t(debugMode ? "debug.hide" : "debug.show")}
      aria-label={t(debugMode ? "debug.hide" : "debug.show")}
      aria-pressed={debugMode}
      className={`h-8 w-8 flex items-center justify-center rounded-full border border-border text-sm transition-colors ${
        debugMode ? "gradient-brand" : "bg-surface hover:bg-surface-muted"
      }`}
    >
      🐞
    </button>
  );
}
