import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 28,
          background: "#120d09",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            width: 140,
            height: 140,
            borderRadius: 36,
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(135deg, #d94a1a, #ff7a1a, #ffb703)",
            fontSize: 56,
            fontWeight: 900,
            color: "#120d09",
          }}
        >
          FA
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 64,
            fontWeight: 800,
            backgroundImage: "linear-gradient(135deg, #d94a1a, #ff7a1a, #ffb703)",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          Face AI ID
        </div>
        <div style={{ display: "flex", fontSize: 28, color: "#c9b6a1" }}>
          Real-time gesture recognition, entirely in the browser
        </div>
      </div>
    ),
    { ...size },
  );
}
