"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import SplashScreen from "@/components/SplashScreen";
import LanguageToggle from "@/components/LanguageToggle";
import ThemeToggle from "@/components/ThemeToggle";
import CameraFeed from "@/components/CameraFeed";
import FaceCameraFeed from "@/components/FaceCameraFeed";
import FaceIdCameraFeed from "@/components/FaceIdCameraFeed";
import ModeSwitcher, { type Mode } from "@/components/ModeSwitcher";
import { useLanguage } from "@/lib/i18n";

const heroSubtitleKey: Record<Mode, string> = {
  hands: "hero.subtitle",
  face: "hero.subtitleFace",
  faceId: "hero.subtitleFaceId",
};

const heroTitleKey: Record<Mode, string> = {
  hands: "hero.title",
  face: "hero.titleFace",
  faceId: "hero.titleFaceId",
};

export default function Home() {
  const [showSplash, setShowSplash] = useState(true);
  const [mode, setMode] = useState<Mode>("hands");
  const { t } = useLanguage();

  return (
    <>
      {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}

      <div className="flex flex-col flex-1 bg-background">
        <header className="flex flex-col gap-4 px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-10">
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-2"
          >
            <div className="h-8 w-8 rounded-lg gradient-brand flex items-center justify-center text-sm font-black text-black">
              FA
            </div>
            <span className="font-bold tracking-tight">{t("app.title")}</span>
          </motion.div>

          <div className="flex flex-wrap items-center gap-3">
            <ModeSwitcher mode={mode} onChange={setMode} />
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </header>

        <main className="flex flex-1 flex-col items-center justify-center gap-10 px-6 py-10 sm:px-10">
          <div className="text-center max-w-xl">
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gradient-brand mb-3">
              {t(heroTitleKey[mode])}
            </h1>
            <p className="text-foreground-muted">{t(heroSubtitleKey[mode])}</p>
          </div>

          <div className="w-full flex justify-center">
            {mode === "hands" && <CameraFeed />}
            {mode === "face" && <FaceCameraFeed />}
            {mode === "faceId" && <FaceIdCameraFeed />}
          </div>
        </main>

        <footer className="flex flex-col items-center gap-2 px-6 py-8 text-center text-xs text-foreground-muted sm:text-sm">
          <p>{t("footer.privacy")}</p>
          <p>
            {t("footer.developedBy")}{" "}
            <a
              href="https://ividi.dev/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-accent hover:underline"
            >
              David Arsénio Martins
            </a>{" "}
            ·{" "}
            <a
              href="https://github.com/VidiPT89/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-accent hover:underline"
            >
              GitHub
            </a>
          </p>
        </footer>
      </div>
    </>
  );
}
