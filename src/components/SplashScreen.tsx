"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLanguage } from "@/lib/i18n";

export default function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 2600);
    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence onExitComplete={onFinish}>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-background"
        >
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="flex flex-col items-center gap-4"
          >
            <motion.div
              animate={{ boxShadow: ["0 0 20px 0 rgba(255,122,26,0.35)", "0 0 45px 8px rgba(255,183,3,0.45)", "0 0 20px 0 rgba(255,122,26,0.35)"] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
              className="h-24 w-24 rounded-3xl gradient-brand flex items-center justify-center text-4xl font-black text-black"
            >
              FA
            </motion.div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gradient-brand">
              {t("app.title")}
            </h1>
            <p className="text-foreground-muted text-sm sm:text-base">{t("app.tagline")}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="flex flex-col items-center gap-1 text-xs sm:text-sm text-foreground-muted"
          >
            <p className="font-medium text-foreground">{t("splash.developedBy")}</p>
            <div className="flex items-center gap-3">
              <a
                href="https://ividi.dev/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-accent transition-colors"
              >
                ividi.dev
              </a>
              <span className="opacity-40">·</span>
              <a
                href="https://github.com/VidiPT89/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-accent transition-colors"
              >
                github.com/VidiPT89
              </a>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
