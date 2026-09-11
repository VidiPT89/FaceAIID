"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLanguage } from "@/lib/i18n";
import { useDebugMode } from "@/lib/debugMode";
import {
  classifyHandGesture,
  computeHandDebugInfo,
  HandGestureStabilizer,
  type HandDebugInfo,
  type HandGesture,
} from "@/lib/gestures/handGestures";
import { getHandLandmarker } from "@/lib/mediapipe/handLandmarker";

type Status = "idle" | "loading" | "running" | "denied" | "error";
type Handedness = "left" | "right" | "unknown";

interface DetectedHand {
  gesture: HandGesture;
  handedness: Handedness;
}

const gestureLabelKey: Record<HandGesture, string> = {
  thumbsUp: "gesture.thumbsUp",
  thumbsDown: "gesture.thumbsDown",
  openPalm: "gesture.openPalm",
  closedFist: "gesture.closedFist",
  peaceSign: "gesture.peaceSign",
  pointing: "gesture.pointing",
  threeFingers: "gesture.threeFingers",
  shaka: "gesture.shaka",
  iLoveYou: "gesture.iLoveYou",
  letterI: "gesture.letterI",
  letterL: "gesture.letterL",
  letterO: "gesture.letterO",
  rockOn: "gesture.rockOn",
  none: "gesture.none",
};

export default function CameraFeed() {
  const { t } = useLanguage();
  const { debugMode } = useDebugMode();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const landmarkerRef = useRef<import("@mediapipe/tasks-vision").HandLandmarker | null>(null);
  const drawingUtilsRef = useRef<import("@mediapipe/tasks-vision").DrawingUtils | null>(null);
  const connectionsRef = useRef<{ start: number; end: number }[]>([]);
  const rafRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // One stabilizer per tracked hand slot (by array position — MediaPipe
  // doesn't give hands a stable identity across frames).
  const stabilizersRef = useRef<HandGestureStabilizer[]>([]);

  const [status, setStatus] = useState<Status>("idle");
  const [hands, setHands] = useState<DetectedHand[]>([]);
  const [handDebug, setHandDebug] = useState<HandDebugInfo | null>(null);
  const [loopError, setLoopError] = useState<string | null>(null);

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    stabilizersRef.current = [];
    setStatus("idle");
    setHands([]);
  }, []);

  useEffect(() => stop, [stop]);

  // Held in a ref so the recursive requestAnimationFrame call doesn't need
  // to reference the function by name before its own definition finishes.
  const detectLoopRef = useRef<() => void>(() => {});

  const detectLoop = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const landmarker = landmarkerRef.current;
    const drawingUtils = drawingUtilsRef.current;
    if (!video || !canvas || !landmarker || !drawingUtils || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(() => detectLoopRef.current());
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Critical: without this try/catch, a single thrown error from
    // detectForVideo (or anything below it) kills the requestAnimationFrame
    // loop for good — the camera keeps showing a live picture, looking
    // "on", but detection silently stops forever with no visible error.
    // That's indistinguishable from "the model just doesn't work" from the
    // user's side, so every frame is now isolated and logged instead.
    try {
      const result = landmarker.detectForVideo(video, performance.now());

      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      // The actual camera image was never drawn here before — only the
      // skeleton — so the canvas showed floating lines on an empty
      // background instead of the live picture underneath them.
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const detectedHands: DetectedHand[] = [];
      let firstHandDebug: HandDebugInfo | null = null;

      if (result.landmarks && result.landmarks.length > 0) {
        result.landmarks.forEach((landmarks, i) => {
          drawingUtils.drawConnectors(landmarks, connectionsRef.current, {
            color: "#ffb703",
            lineWidth: 3,
          });
          drawingUtils.drawLandmarks(landmarks, {
            color: "#ff7a1a",
            fillColor: "#ff7a1a",
            radius: 4,
          });

          const rawGesture = classifyHandGesture(landmarks);
          if (!stabilizersRef.current[i]) stabilizersRef.current[i] = new HandGestureStabilizer();
          const gesture = stabilizersRef.current[i].push(rawGesture);

          // MediaPipe's handedness assumes a mirrored (selfie) input image;
          // our video frame is fed to the model un-mirrored (we only mirror
          // the canvas at draw time), so the raw label is the opposite of
          // what the user sees in the mirrored preview — swap it so "left"
          // means "the hand that looks like your left hand" on screen.
          const rawLabel = result.handedness?.[i]?.[0]?.categoryName;
          const handedness: Handedness = rawLabel === "Left" ? "right" : rawLabel === "Right" ? "left" : "unknown";

          detectedHands.push({ gesture, handedness });
          if (i === 0) firstHandDebug = computeHandDebugInfo(landmarks);
        });
      }
      stabilizersRef.current.length = detectedHands.length;

      ctx.restore();
      setHands(detectedHands);
      setHandDebug(firstHandDebug);
      setLoopError(null);
    } catch (err) {
      console.error("[FaceAIID] hand detection frame failed", err);
      setLoopError(err instanceof Error ? err.message : String(err));
    }

    rafRef.current = requestAnimationFrame(() => detectLoopRef.current());
  }, []);

  useEffect(() => {
    detectLoopRef.current = detectLoop;
  }, [detectLoop]);

  const start = useCallback(async () => {
    setStatus("loading");
    try {
      landmarkerRef.current = await getHandLandmarker();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;
      video.srcObject = stream;
      await video.play();

      const ctx = canvas.getContext("2d");
      if (ctx) {
        const { DrawingUtils, HandLandmarker } = await import("@mediapipe/tasks-vision");
        drawingUtilsRef.current = new DrawingUtils(ctx);
        connectionsRef.current = HandLandmarker.HAND_CONNECTIONS;
      }

      setStatus("running");
      rafRef.current = requestAnimationFrame(() => detectLoopRef.current());
    } catch (err) {
      console.error(err);
      const domErr = err as DOMException;
      setStatus(domErr?.name === "NotAllowedError" ? "denied" : "error");
    }
  }, []);

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      <div className="relative w-full max-w-2xl aspect-video rounded-2xl overflow-hidden border border-border bg-surface shadow-2xl shadow-black/10">
        <video ref={videoRef} className="hidden" playsInline muted />
        <canvas ref={canvasRef} className="w-full h-full object-cover" />
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
              {status === "idle" && <p className="text-foreground-muted">{t("hero.subtitle")}</p>}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {status === "running" && hands.some((h) => h.gesture !== "none") && (
            <motion.div
              key={hands.map((h) => `${h.handedness}-${h.gesture}`).join("|")}
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1"
            >
              {hands
                .filter((h) => h.gesture !== "none")
                .map((h, i) => (
                  <span
                    key={i}
                    className="gradient-brand text-black font-semibold px-5 py-2 rounded-full shadow-lg text-sm"
                  >
                    {h.handedness !== "unknown" && `${t(`hand.${h.handedness}`)} — `}
                    {t(gestureLabelKey[h.gesture])}
                  </span>
                ))}
            </motion.div>
          )}
        </AnimatePresence>

        {status === "running" && (loopError || debugMode) && (
          <div className="absolute top-2 left-2 rounded-md bg-black/60 px-2 py-1 text-[11px] font-mono text-white/90">
            {loopError && <div>error: {loopError}</div>}
            {debugMode && <div>hands: {hands.length}</div>}
            {debugMode && handDebug && (
              <div>
                thumb {handDebug.thumbAngle.toFixed(0)}° ({handDebug.thumbExtended ? "out" : "in"}) · pinch{" "}
                {handDebug.pinch.toFixed(2)}
              </div>
            )}
          </div>
        )}
      </div>

      <motion.button
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        onClick={status === "running" ? stop : start}
        className="gradient-brand text-black font-semibold px-8 py-3 rounded-full shadow-lg shadow-orange-900/20 transition-shadow hover:shadow-xl"
      >
        {status === "running" ? t("camera.stop") : t("camera.start")}
      </motion.button>
    </div>
  );
}
