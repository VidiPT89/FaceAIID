"use client";

import type { ReactNode, RefObject } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLanguage } from "@/lib/i18n";
import type { CameraStatus } from "@/lib/useCameraLoop";

interface CameraStageProps {
  camera: {
    videoRef: RefObject<HTMLVideoElement | null>;
    status: CameraStatus;
    loopError: string | null;
    start: () => void;
    stop: () => void;
  };
  /** Shown over the empty stage before the camera starts. */
  idleText: string;
  /** Hands/Face draw the frame onto a canvas (passed as `canvas`) and keep
   *  the video hidden; Identification shows the mirrored video directly. */
  canvas?: ReactNode;
  /** Result badges, rendered only while running. */
  badges?: ReactNode;
  /** Diagnostic lines, rendered only while running and in debug mode. */
  debugLines?: ReactNode;
}

/** The camera box, its status overlay and the start/stop button — shared
 *  by every mode. */
export default function CameraStage({ camera, idleText, canvas, badges, debugLines }: CameraStageProps) {
  const { t } = useLanguage();
  const { videoRef, status, loopError, start, stop } = camera;
  const active = status === "running" || status === "loading";

  return (
    <>
      <div className="relative w-full max-w-2xl aspect-video rounded-2xl overflow-hidden border border-border bg-surface shadow-2xl shadow-black/10">
        <video
          ref={videoRef}
          className={canvas ? "hidden" : "w-full h-full object-cover -scale-x-100"}
          playsInline
          muted
        />
        {canvas}

        <AnimatePresence>
          {status !== "running" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface-muted/95 text-center px-6"
              role="status"
            >
              {status === "loading" && (
                <>
                  <div className="h-10 w-10 rounded-full border-4 border-accent border-t-transparent animate-spin" />
                  <p className="text-foreground-muted">{t("camera.loading")}</p>
                </>
              )}
              {status === "denied" && <p className="text-accent-3">{t("camera.permission")}</p>}
              {status === "error" && <p className="text-accent-3">{t("camera.error")}</p>}
              {status === "idle" && <p className="text-foreground-muted">{idleText}</p>}
            </motion.div>
          )}
        </AnimatePresence>

        {status === "running" && badges}

        {status === "running" && (loopError || debugLines) && (
          <div className="absolute top-2 left-2 rounded-md bg-black/60 px-2 py-1 text-[10px] font-mono text-white/90 leading-tight">
            {loopError && <div>error: {loopError}</div>}
            {debugLines}
          </div>
        )}
      </div>

      <motion.button
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        onClick={active ? stop : start}
        className="gradient-brand text-black font-semibold px-8 py-3 rounded-full shadow-lg shadow-orange-900/20 transition-shadow hover:shadow-xl"
      >
        {status === "running" ? t("camera.stop") : status === "loading" ? t("camera.cancel") : t("camera.start")}
      </motion.button>
    </>
  );
}

/** Animated row of result pills at the bottom of the stage. `animationKey`
 *  changes whenever the content does, so each new result animates in, and
 *  `show` false animates the row out. */
export function BadgeRow({
  show,
  animationKey,
  children,
  vertical = false,
}: {
  show: boolean;
  animationKey: string;
  children: ReactNode;
  vertical?: boolean;
}) {
  return (
    <AnimatePresence>
      {show && (
      <motion.div
        key={animationKey}
        initial={{ opacity: 0, y: 10, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.9 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className={`absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center ${vertical ? "flex-col gap-1" : "gap-2"}`}
        aria-live="polite"
      >
        {children}
      </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Badge({ children, muted = false }: { children: ReactNode; muted?: boolean }) {
  return (
    <span
      className={`font-semibold px-5 py-2 rounded-full shadow-lg text-sm whitespace-nowrap ${
        muted ? "bg-black/70 text-white" : "gradient-brand text-black"
      }`}
    >
      {children}
    </span>
  );
}
