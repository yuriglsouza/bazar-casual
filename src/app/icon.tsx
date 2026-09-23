import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(145deg, #ff4b94, #d20c5b)", color: "white", fontSize: 168, fontWeight: 900, letterSpacing: -16, borderRadius: 112 }}>
      BC
    </div>,
    size,
  );
}
