"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type Language = "pt" | "en";

type Dictionary = Record<string, string>;

const dictionaries: Record<Language, Dictionary> = {
  pt: {
    "app.title": "Face AI ID",
    "app.tagline": "Reconhecimento de gestos e expressões em tempo real",
    "splash.developedBy": "Criado por David Arsénio Martins",
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
    "gesture.peaceSign": "Sinal de paz ✌️",
    "gesture.pointing": "A apontar ☝️",
    "gesture.thumbsDown": "Não gostei 👎",
    "gesture.threeFingers": "Três dedos (W) 🤟",
    "gesture.shaka": "Shaka 🤙",
    "gesture.iLoveYou": "Amo-te (LGP/ASL) 🤟",
    "gesture.letterL": "Letra L (LGP/ASL) 👆",
    "gesture.letterO": "Letra O (LGP/ASL) 👌",
    "hand.left": "Mão esquerda",
    "hand.right": "Mão direita",
    "theme.light": "Claro",
    "theme.dark": "Escuro",
    "theme.system": "Sistema",
    "footer.privacy":
      "Privacidade em primeiro lugar: o vídeo nunca sai do teu dispositivo.",
    "footer.developedBy": "Desenvolvido por",
    "mode.hands": "Mãos",
    "mode.face": "Rosto",
    "mode.faceId": "Identificação",
    "hero.titleFace": "Expressões e movimento de cabeça",
    "hero.subtitleFace":
      "Aponta a câmara à tua cara. Deteta sorriso, tristeza, surpresa, zanga, piscar de olhos, aceno de cabeça e inclinação.",
    "hero.titleFaceId": "Identificação facial",
    "hero.subtitleFaceId":
      "Regista a tua cara e a app reconhece-te depois. Tudo guardado só neste dispositivo (localStorage) — nunca sai daqui.",
    "expression.none": "Nenhuma expressão detetada",
    "expression.smile": "A sorrir 😊",
    "expression.sad": "Triste 😢",
    "expression.surprised": "Surpreso(a) 😲",
    "expression.angry": "Zangado(a) 😠",
    "expression.blink": "A piscar 😉",
    "head.none": "Sem movimento detetado",
    "head.nodYes": "A acenar que sim 👍",
    "head.shakeNo": "A acenar que não 👎",
    "head.tilt": "Cabeça inclinada",
    "faceId.namePlaceholder": "Nome da pessoa",
    "faceId.register": "Registar rosto",
    "faceId.registered": "{name} registado(a) com sucesso.",
    "faceId.noFaceDetected": "Não foi detetado nenhum rosto. Aproxima-te da câmara.",
    "faceId.unknown": "Rosto não reconhecido",
    "faceId.remove": "Remover",
    "faceId.privacyNote":
      "Os rostos registados ficam guardados apenas no localStorage deste browser — nunca são enviados para nenhum servidor.",
  },
  en: {
    "app.title": "Face AI ID",
    "app.tagline": "Real-time gesture and expression recognition",
    "splash.developedBy": "Developed by David Arsénio Martins",
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
    "gesture.peaceSign": "Peace sign ✌️",
    "gesture.pointing": "Pointing ☝️",
    "gesture.thumbsDown": "Thumbs down 👎",
    "gesture.threeFingers": "Three fingers (W) 🤟",
    "gesture.shaka": "Shaka 🤙",
    "gesture.iLoveYou": "I love you (ASL/LGP) 🤟",
    "gesture.letterL": "Letter L (ASL/LGP) 👆",
    "gesture.letterO": "Letter O (ASL/LGP) 👌",
    "hand.left": "Left hand",
    "hand.right": "Right hand",
    "theme.light": "Light",
    "theme.dark": "Dark",
    "theme.system": "System",
    "footer.privacy": "Privacy first: video never leaves your device.",
    "footer.developedBy": "Developed by",
    "mode.hands": "Hands",
    "mode.face": "Face",
    "mode.faceId": "Identification",
    "hero.titleFace": "Expressions and head movement",
    "hero.subtitleFace":
      "Point the camera at your face. Detects smile, sadness, surprise, anger, blinking, head nods and tilt.",
    "hero.titleFaceId": "Face identification",
    "hero.subtitleFaceId":
      "Register your face and the app will recognize you afterwards. Stored only on this device (localStorage) — it never leaves it.",
    "expression.none": "No expression detected",
    "expression.smile": "Smiling 😊",
    "expression.sad": "Sad 😢",
    "expression.surprised": "Surprised 😲",
    "expression.angry": "Angry 😠",
    "expression.blink": "Blinking 😉",
    "head.none": "No movement detected",
    "head.nodYes": "Nodding yes 👍",
    "head.shakeNo": "Shaking no 👎",
    "head.tilt": "Head tilted",
    "faceId.namePlaceholder": "Person's name",
    "faceId.register": "Register face",
    "faceId.registered": "{name} registered successfully.",
    "faceId.noFaceDetected": "No face detected. Move closer to the camera.",
    "faceId.unknown": "Face not recognized",
    "faceId.remove": "Remove",
    "faceId.privacyNote":
      "Registered faces are stored only in this browser's localStorage — never sent to any server.",
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
