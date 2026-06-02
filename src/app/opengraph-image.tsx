import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "CareSense AI — Feel sick? We've got you.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
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
          background: "linear-gradient(160deg, #F0F6FF 0%, #FFFFFF 45%, #EDF9F3 100%)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Blue glow top-right */}
        <div
          style={{
            position: "absolute",
            top: -180,
            right: -180,
            width: 560,
            height: 560,
            borderRadius: "50%",
            background: "radial-gradient(circle at center, rgba(30,64,175,0.18) 0%, transparent 70%)",
            filter: "blur(60px)",
          }}
        />
        {/* Green glow bottom-left */}
        <div
          style={{
            position: "absolute",
            bottom: -160,
            left: -160,
            width: 520,
            height: 520,
            borderRadius: "50%",
            background: "radial-gradient(circle at center, rgba(5,150,105,0.18) 0%, transparent 70%)",
            filter: "blur(60px)",
          }}
        />

        {/* Wordmark */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 40,
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: "linear-gradient(135deg, #1E40AF, #059669)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div style={{ color: "white", fontSize: 22 }}>♥</div>
          </div>
          <span style={{ fontSize: 28, fontWeight: 600, color: "#1E293B", letterSpacing: "-0.5px" }}>
            CareSense AI
          </span>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "white",
              background: "#1E40AF",
              padding: "2px 6px",
              borderRadius: 4,
              letterSpacing: "0.5px",
            }}
          >
            BETA
          </div>
        </div>

        {/* Headline */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 0,
            marginBottom: 32,
          }}
        >
          <span
            style={{
              fontSize: 80,
              fontWeight: 800,
              color: "#0F172A",
              letterSpacing: "-2px",
              lineHeight: 1.1,
            }}
          >
            Feel sick?
          </span>
          <span
            style={{
              fontSize: 80,
              fontWeight: 800,
              fontStyle: "italic",
              color: "#059669",
              letterSpacing: "-2px",
              lineHeight: 1.1,
            }}
          >
            We&apos;ve got you.
          </span>
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 22,
            color: "#64748B",
            textAlign: "center",
            maxWidth: 720,
            lineHeight: 1.5,
          }}
        >
          Home care · Specialist guidance · Providers near you
        </div>

        {/* Bottom gradient bar */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 5,
            background: "linear-gradient(to right, #1E40AF, #059669)",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
