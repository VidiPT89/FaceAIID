"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLanguage } from "@/lib/i18n";
import {
  loadFaceModels,
  describeFace,
  saveKnownFace,
  matchFace,
  getKnownFaceNames,
  sampleCountFor,
  deleteKnownFace,
  MAX_SAMPLES_PER_PERSON,
} from "@/lib/faceId/faceRecognition";

type Status = "idle" | "loading" | "running" | "denied" | "error";

export default function FaceIdCameraFeed() {
  const { t } = useLanguage();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const loopRef = useRef<() => void>(() => {});
  const busyRef = useRef(false);

  const [status, setStatus] = useState<Status>("idle");
  const [match, setMatch] = useState<{ name: string; distance: number } | null>(null);
  const [knownFaces, setKnownFaces] = useState<string[]>([]);
  const [nameInput, setNameInput] = useState("");
  const [registering, setRegistering] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    // Deliberately deferred to an effect: localStorage is only available
    // client-side, so the first render must match the server (empty list)
    // before this runs, avoiding a hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setKnownFaces(getKnownFaceNames());
  }, []);

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStatus("idle");
    setMatch(null);
  }, []);

  useEffect(() => stop, [stop]);

  const recognizeLoop = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || busyRef.current) {
      rafRef.current = requestAnimationFrame(() => loopRef.current());
      return;
    }

    busyRef.current = true;
    describeFace(video)
      .then((result) => {
        if (result) {
          setMatch(matchFace(result.descriptor));
        } else {
          setMatch(null);
        }
      })
      .catch((err) => {
        console.error("[FaceAIID] face identification frame failed", err);
      })
      .finally(() => {
        busyRef.current = false;
        rafRef.current = requestAnimationFrame(() => loopRef.current());
      });
  }, []);

  useEffect(() => {
    loopRef.current = recognizeLoop;
  }, [recognizeLoop]);

  const start = useCallback(async () => {
    setStatus("loading");
    try {
      await loadFaceModels();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();

      setStatus("running");
      rafRef.current = requestAnimationFrame(() => loopRef.current());
    } catch (err) {
      console.error(err);
      const domErr = err as DOMException;
      setStatus(domErr?.name === "NotAllowedError" ? "denied" : "error");
    }
  }, []);

  const handleRegister = useCallback(async () => {
    const video = videoRef.current;
    const name = nameInput.trim();
    if (!video || !name) return;

    setRegistering(true);
    setFeedback(null);
    try {
      const result = await describeFace(video);
      if (!result) {
        setFeedback(t("faceId.noFaceDetected"));
        return;
      }
      saveKnownFace(name, result.descriptor);
      setKnownFaces(getKnownFaceNames());
      setNameInput("");
      setFeedback(`${t("faceId.sampleSaved")} (${sampleCountFor(name)}/${MAX_SAMPLES_PER_PERSON})`);
    } finally {
      setRegistering(false);
    }
  }, [nameInput, t]);

  const handleDelete = useCallback((name: string) => {
    deleteKnownFace(name);
    setKnownFaces(getKnownFaceNames());
  }, []);

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      <div className="relative w-full max-w-2xl aspect-video rounded-2xl overflow-hidden border border-border bg-surface shadow-2xl shadow-black/10">
        <video
          ref={videoRef}
          className="w-full h-full object-cover -scale-x-100"
          playsInline
          muted
        />
        <AnimatePresence>
          {status !== "running" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface-muted/95 text-center px-6"
            >
              {status === "loading" && (
                <>
                  <div className="h-10 w-10 rounded-full border-4 border-accent border-t-transparent animate-spin" />
                  <p className="text-foreground-muted">{t("camera.loading")}</p>
                </>
              )}
              {status === "denied" && <p className="text-accent-3">{t("camera.permission")}</p>}
              {status === "error" && <p className="text-accent-3">{t("camera.error")}</p>}
              {status === "idle" && <p className="text-foreground-muted">{t("hero.subtitleFaceId")}</p>}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {status === "running" && (
            <motion.div
              key={match ? match.name : "unknown"}
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className={`absolute bottom-4 left-1/2 -translate-x-1/2 font-semibold px-5 py-2 rounded-full shadow-lg text-sm ${
                match ? "gradient-brand text-black" : "bg-black/70 text-white"
              }`}
            >
              {match ? `${match.name}` : t("faceId.unknown")}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <motion.button
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        onClick={status === "running" ? stop : start}
        className="gradient-brand text-black font-semibold px-8 py-3 rounded-full shadow-lg shadow-orange-900/20 transition-shadow hover:shadow-xl"
      >
        {status === "running" ? t("camera.stop") : t("camera.start")}
      </motion.button>

      {status === "running" && (
        <div className="flex flex-col items-center gap-3 w-full max-w-md">
          <div className="flex w-full gap-2">
            <input
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder={t("faceId.namePlaceholder")}
              className="flex-1 rounded-full border border-border bg-surface px-4 py-2 text-sm outline-none focus:border-accent"
            />
            <button
              onClick={handleRegister}
              disabled={!nameInput.trim() || registering}
              className="gradient-brand text-black text-sm font-semibold px-4 py-2 rounded-full disabled:opacity-40"
            >
              {t("faceId.register")}
            </button>
          </div>
          {feedback && <p className="text-xs text-foreground-muted">{feedback}</p>}
        </div>
      )}

      {knownFaces.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2 max-w-md">
          {knownFaces.map((name) => (
            <span
              key={name}
              className="flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs"
            >
              {name}
              <button
                onClick={() => handleDelete(name)}
                className="text-foreground-muted hover:text-accent-3"
                aria-label={`${t("faceId.remove")} ${name}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <p className="text-xs text-foreground-muted text-center max-w-md">{t("faceId.privacyNote")}</p>
    </div>
  );
}
