"use client";

import { useLanguage } from "@/lib/i18n";

export default function LanguageToggle() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="flex items-center rounded-full border border-border bg-surface p-1 text-sm font-medium">
      {(["pt", "en"] as const).map((lang) => (
        <button
          key={lang}
          onClick={() => setLanguage(lang)}
          className={`px-3 py-1.5 rounded-full transition-colors ${
            language === lang
              ? "gradient-brand text-black"
              : "text-foreground-muted hover:text-foreground"
          }`}
        >
          {lang.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
