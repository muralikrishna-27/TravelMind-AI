import { ImageResponse } from "next/og";

export const alt = "TravelMind AI — Trips planned by a team of agents";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#0b120e",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          color: "#f4f7f5",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            fontSize: "24px",
            fontWeight: 600,
          }}
        >
          <span>TravelMind AI</span>
          <span
            style={{
              marginLeft: "16px",
              fontSize: "16px",
              color: "#4ade80",
              background: "rgba(74,222,128,0.12)",
              padding: "6px 14px",
              borderRadius: "999px",
            }}
          >
            Human-in-the-loop review
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div
            style={{
              fontSize: "76px",
              lineHeight: 1.02,
              letterSpacing: "-0.02em",
              maxWidth: "920px",
            }}
          >
            Trips planned by a team of agents.
          </div>
          <div
            style={{
              fontSize: "26px",
              color: "#9aa8a0",
              maxWidth: "760px",
              lineHeight: 1.4,
            }}
          >
            Watch flights, hotels, weather and budget get researched live.
            Review the plan, change any day, then approve.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "18px",
            fontSize: "18px",
            color: "#9aa8a0",
          }}
        >
          <span>LangGraph</span>
          <span>·</span>
          <span>Groq</span>
          <span>·</span>
          <span>Tavily</span>
          <span>·</span>
          <span>AviationStack</span>
          <span>·</span>
          <span>OpenWeather</span>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
