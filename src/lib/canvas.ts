/**
 * Sizes the canvas to the video, then draws the current frame mirrored
 * (selfie view) and leaves the context mirrored so landmark overlays drawn
 * next line up with it. The caller must `ctx.restore()` when done.
 *
 * The canvas is only resized when the video's size actually changes:
 * assigning `canvas.width` — even to the same value — reallocates the
 * bitmap and resets all context state, which the detection loops used to
 * do on every frame.
 */
export function prepareMirroredFrame(canvas: HTMLCanvasElement, video: HTMLVideoElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2D context unavailable");

  if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth;
  if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;

  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return ctx;
}
