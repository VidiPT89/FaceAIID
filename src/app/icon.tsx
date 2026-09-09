import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 14,
          background: "linear-gradient(135deg, #d94a1a, #ff7a1a, #ffb703)",
          fontSize: 30,
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
