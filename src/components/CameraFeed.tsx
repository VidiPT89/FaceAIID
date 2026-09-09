"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLanguage } from "@/lib/i18n";
import { classifyHandGesture, type HandGesture } from "@/lib/gestures/handGestures";

type Status = "idle" | "loading" | "running" | "denied" | "error";

const CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

const gestureLabelKey: Record<HandGesture, string> = {
  thumbsUp: "gesture.thumbsUp",
  openPalm: "gesture.openPalm",
  closedFist: "gesture.closedFist",
  none: "gesture.none",
};

export default function CameraFeed() {
  const { t } = useLanguage();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const landmarkerRef = useRef<import("@mediapipe/tasks-vision").HandLandmarker | null>(null);
  const rafRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [status, setStatus] = useState<Status>("idle");
  const [gesture, setGesture] = useState<HandGesture>("none");

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStatus("idle");
    setGesture("none");
  }, []);

  useEffect(() => stop, [stop]);

  const detectLoop = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const landmarker = landmarkerRef.current;
    if (!video || !canvas || !landmarker || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(detectLoop);
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const result = landmarker.detectForVideo(video, performance.now());

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);

    let detected: HandGesture = "none";

    if (result.landmarks && result.landmarks.length > 0) {
      for (const landmarks of result.landmarks) {
        ctx.strokeStyle = "#ffb703";
        ctx.lineWidth = 3;
        for (const [a, b] of CONNECTIONS) {
          const pa = landmarks[a];
          const pb = landmarks[b];
          ctx.beginPath();
          ctx.moveTo(pa.x * canvas.width, pa.y * canvas.height);
          ctx.lineTo(pb.x * canvas.width, pb.y * canvas.height);
          ctx.stroke();
        }
        ctx.fillStyle = "#ff7a1a";
        for (const point of landmarks) {
          ctx.beginPath();
          ctx.arc(point.x * canvas.width, point.y * canvas.height, 4, 0, Math.PI * 2);
          ctx.fill();
        }

        const classification = classifyHandGesture(landmarks);
        if (classification !== "none") detected = classification;
      }
    }

    ctx.restore();
    setGesture(detected);

    rafRef.current = requestAnimationFrame(detectLoop);
  }, []);

  const start = useCallback(async () => {
    setStatus("loading");
    try {
      const { FilesetResolver, HandLandmarker } = await import("@mediapipe/tasks-vision");
      if (!landmarkerRef.current) {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm",
        );
        landmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numHands: 2,
        });
      }

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
      rafRef.current = requestAnimationFrame(detectLoop);
    } catch (err) {
      console.error(err);
      const domErr = err as DOMException;
      setStatus(domErr?.name === "NotAllowedError" ? "denied" : "error");
    }
  }, [detectLoop]);

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      <div className="relative w-full max-w-2xl aspect-video rounded-2xl overflow-hidden border border-border bg-surface shadow-2xl shadow-black/10">
        <video ref={videoRef} className="hidden" playsInline muted />
        <canvas
          ref={canvasRef}
          className="w-full h-full object-cover -scale-x-100"
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
              {status === "idle" && <p className="text-foreground-muted">{t("hero.subtitle")}</p>}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {status === "running" && gesture !== "none" && (
            <motion.div
              key={gesture}
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="absolute bottom-4 left-1/2 -translate-x-1/2 gradient-brand text-black font-semibold px-5 py-2 rounded-full shadow-lg"
            >
              {t(gestureLabelKey[gesture])}
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
    </div>
  );
}
