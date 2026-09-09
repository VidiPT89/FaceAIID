"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type Language = "pt" | "en";

type Dictionary = Record<string, string>;

const dictionaries: Record<Language, Dictionary> = {
  pt: {
    "app.title": "Face AI ID",
    "app.tagline": "Reconhecimento de gestos e expressões em tempo real",
    "splash.developedBy": "Criado por David Arsénio Martins",
    "splash.website": "Site",
    "splash.github": "GitHub",
    "hero.title": "Reconhecimento de gestos em tempo real",
    "hero.subtitle":
      "Aponta a câmara e mostra a mão. Tudo é processado localmente no teu browser — nada é enviado para nenhum servidor.",
    "camera.start": "Iniciar câmara",
    "camera.stop": "Parar câmara",
    "camera.permission": "É necessário dar permissão de acesso à câmara.",
    "camera.loading": "A carregar o modelo de deteção…",
    "camera.error": "Não foi possível aceder à câmara.",
    "gesture.none": "Nenhum gesto detetado",
    "gesture.thumbsUp": "Fixe 👍",
    "gesture.openPalm": "Mão aberta ✋",
    "gesture.closedFist": "Punho fechado ✊",
    "gesture.detected": "Gesto detetado",
    "theme.light": "Claro",
    "theme.dark": "Escuro",
    "theme.system": "Sistema",
    "footer.privacy":
      "Privacidade em primeiro lugar: o vídeo nunca sai do teu dispositivo.",
    "footer.developedBy": "Desenvolvido por",
  },
  en: {
    "app.title": "Face AI ID",
    "app.tagline": "Real-time gesture and expression recognition",
    "splash.developedBy": "Developed by David Arsénio Martins",
    "splash.website": "Website",
    "splash.github": "GitHub",
    "hero.title": "Real-time gesture recognition",
    "hero.subtitle":
      "Point the camera and show your hand. Everything runs locally in your browser — nothing is sent to any server.",
    "camera.start": "Start camera",
    "camera.stop": "Stop camera",
    "camera.permission": "Camera access permission is required.",
    "camera.loading": "Loading detection model…",
    "camera.error": "Could not access the camera.",
    "gesture.none": "No gesture detected",
    "gesture.thumbsUp": "Thumbs up 👍",
    "gesture.openPalm": "Open palm ✋",
    "gesture.closedFist": "Closed fist ✊",
    "gesture.detected": "Gesture detected",
    "theme.light": "Light",
    "theme.dark": "Dark",
    "theme.system": "System",
    "footer.privacy": "Privacy first: video never leaves your device.",
    "footer.developedBy": "Developed by",
  },
};

interface LanguageContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

const STORAGE_KEY = "faceaiid-language";

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("pt");

  useEffect(() => {
    // Deliberately deferred to an effect: localStorage/navigator.language are
    // only available client-side, so the first render must match the server
    // ("pt") before this runs, avoiding a hydration mismatch.
    const stored = window.localStorage.getItem(STORAGE_KEY) as Language | null;
    if (stored === "pt" || stored === "en") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLanguageState(stored);
      return;
    }
    const browserLang = window.navigator.language.toLowerCase();
    setLanguageState(browserLang.startsWith("pt") ? "pt" : "en");
  }, []);

  const setLanguage = (next: Language) => {
    setLanguageState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  };

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage,
      t: (key: string) => dictionaries[language][key] ?? key,
    }),
    [language],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
