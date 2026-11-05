"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type CameraStatus = "idle" | "loading" | "running" | "denied" | "error";

interface CameraLoopOptions {
  /** Loads whatever model the mode needs, before the camera opens. */
  prepare: () => Promise<void>;
  /** Called once per animation frame with a playable video. May be async;
   *  the next frame is only scheduled after it settles. */
  onFrame: (video: HTMLVideoElement) => void | Promise<void>;
  /** Clears per-run state (trackers, results) when the camera stops. */
  onStop?: () => void;
}

/**
 * Owns the camera stream and the per-frame detection loop shared by every
 * mode: start/stop, permission errors, and isolating each frame so one
 * thrown error can't silently kill the loop while the picture stays live.
 *
 * Each start gets a session number; anything that resolves after a newer
 * start/stop (a slow model load, the permission prompt) sees a stale session
 * and releases what it opened instead of applying it. Without this,
 * switching modes or pressing the button again while the model was still
 * loading left the camera on with no way to turn it off.
 */
export function useCameraLoop({ prepare, onFrame, onStop }: CameraLoopOptions) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const sessionRef = useRef(0);
  const callbacksRef = useRef({ prepare, onFrame, onStop });
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [loopError, setLoopError] = useState<string | null>(null);

  useEffect(() => {
    callbacksRef.current = { prepare, onFrame, onStop };
  });

  const release = useCallback(() => {
    sessionRef.current++;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    callbacksRef.current.onStop?.();
  }, []);

  const stop = useCallback(() => {
    release();
    setStatus("idle");
    setLoopError(null);
  }, [release]);

  useEffect(() => release, [release]);

  const start = useCallback(async () => {
    const session = ++sessionRef.current;
    const isCurrent = () => session === sessionRef.current;
    setStatus("loading");
    setLoopError(null);

    try {
      await callbacksRef.current.prepare();
      if (!isCurrent()) return;

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      if (!isCurrent()) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) throw new Error("video element is not mounted");
      video.srcObject = stream;
      await video.play();
      if (!isCurrent()) return;

      setStatus("running");

      const tick = async () => {
        if (!isCurrent()) return;
        const current = videoRef.current;
        if (current && current.readyState >= 2) {
          try {
            await callbacksRef.current.onFrame(current);
            setLoopError(null);
          } catch (err) {
            console.error("[FaceAIID] detection frame failed", err);
            setLoopError(err instanceof Error ? err.message : String(err));
          }
        }
        if (isCurrent()) rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      if (!isCurrent()) return;
      console.error("[FaceAIID] could not start the camera", err);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      const name = (err as DOMException | undefined)?.name;
      setStatus(name === "NotAllowedError" ? "denied" : "error");
    }
  }, []);

  return { videoRef, status, loopError, start, stop };
}
