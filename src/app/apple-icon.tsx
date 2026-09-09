import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #d94a1a, #ff7a1a, #ffb703)",
          fontSize: 84,
          fontWeight: 900,
          color: "#120d09",
          fontFamily: "sans-serif",
        }}
      >
        FA
      </div>
    ),
    { ...size },
  );
}
