"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import SplashScreen from "@/components/SplashScreen";
import LanguageToggle from "@/components/LanguageToggle";
import ThemeToggle from "@/components/ThemeToggle";
import CameraFeed from "@/components/CameraFeed";
import { useLanguage } from "@/lib/i18n";

export default function Home() {
  const [showSplash, setShowSplash] = useState(true);
  const { t } = useLanguage();

  return (
    <>
      {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}

      <div className="flex flex-col flex-1 bg-background">
        <header className="flex items-center justify-between px-6 py-4 sm:px-10">
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

          <div className="flex items-center gap-3">
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </header>

        <main className="flex flex-1 flex-col items-center justify-center gap-10 px-6 py-10 sm:px-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-center max-w-xl"
          >
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gradient-brand mb-3">
              {t("hero.title")}
            </h1>
            <p className="text-foreground-muted">{t("hero.subtitle")}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="w-full flex justify-center"
          >
            <CameraFeed />
          </motion.div>
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
