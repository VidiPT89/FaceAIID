"use client";

import { useCallback, useEffect, useState } from "react";
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
import { useCameraLoop } from "@/lib/useCameraLoop";
import CameraStage, { Badge, BadgeRow } from "@/components/CameraStage";

export default function FaceIdCameraFeed() {
  const { t } = useLanguage();
  const [matchName, setMatchName] = useState<string | null>(null);
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

  const onFrame = useCallback(async (video: HTMLVideoElement) => {
    const result = await describeFace(video);
    setMatchName(result ? (matchFace(result.descriptor)?.name ?? null) : null);
  }, []);

  const onStop = useCallback(() => {
    setMatchName(null);
    setFeedback(null);
  }, []);

  const camera = useCameraLoop({ prepare: loadFaceModels, onFrame, onStop });
  const { videoRef } = camera;

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
      if (!saveKnownFace(name, result.descriptor)) {
        setFeedback(t("faceId.saveFailed"));
        return;
      }
      setKnownFaces(getKnownFaceNames());
      // The name stays filled so several samples (different angles and
      // lighting) can be saved in a row, which makes matching more robust.
      setFeedback(`${t("faceId.sampleSaved")} (${sampleCountFor(name)}/${MAX_SAMPLES_PER_PERSON})`);
    } catch (err) {
      console.error("[FaceAIID] face registration failed", err);
      setFeedback(t("faceId.saveFailed"));
    } finally {
      setRegistering(false);
    }
  }, [nameInput, t, videoRef]);

  const handleDelete = useCallback((name: string) => {
    deleteKnownFace(name);
    setKnownFaces(getKnownFaceNames());
  }, []);

  const running = camera.status === "running";

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      <CameraStage
        camera={camera}
        idleText={t("hero.subtitleFaceId")}
        badges={
          <BadgeRow show animationKey={matchName ?? "unknown"}>
            {matchName ? <Badge>{matchName}</Badge> : <Badge muted>{t("faceId.unknown")}</Badge>}
          </BadgeRow>
        }
      />

      {running && (
        <form
          className="flex flex-col items-center gap-3 w-full max-w-md"
          onSubmit={(e) => {
            e.preventDefault();
            void handleRegister();
          }}
        >
          <div className="flex w-full gap-2">
            <input
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder={t("faceId.namePlaceholder")}
              aria-label={t("faceId.namePlaceholder")}
              maxLength={40}
              className="flex-1 min-w-0 rounded-full border border-border bg-surface px-4 py-2 text-sm outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={!nameInput.trim() || registering}
              className="gradient-brand text-black text-sm font-semibold px-4 py-2 rounded-full disabled:opacity-40"
            >
              {t("faceId.register")}
            </button>
          </div>
          {feedback && (
            <p className="text-xs text-foreground-muted" role="status">
              {feedback}
            </p>
          )}
        </form>
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
