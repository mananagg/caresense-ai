import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "CareSense AI — Feel sick? We've got you.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const PAD = 70;

// Deterministic dots kept to edges for texture — simple divs, Satori-safe
const DOTS: Array<{ x: number; y: number; r: number; c: string; o: number }> = [
  { x: 50,   y: 28,  r: 3, c: "30,64,175",  o: 0.30 },
  { x: 200,  y: 14,  r: 2, c: "56,189,248", o: 0.26 },
  { x: 380,  y: 36,  r: 4, c: "5,150,105",  o: 0.23 },
  { x: 560,  y: 18,  r: 2, c: "30,64,175",  o: 0.28 },
  { x: 740,  y: 40,  r: 3, c: "56,189,248", o: 0.24 },
  { x: 920,  y: 16,  r: 2, c: "5,150,105",  o: 0.26 },
  { x: 1100, y: 38,  r: 3, c: "30,64,175",  o: 0.22 },
  { x: 30,   y: 592, r: 2, c: "5,150,105",  o: 0.28 },
  { x: 210,  y: 608, r: 4, c: "30,64,175",  o: 0.23 },
  { x: 430,  y: 584, r: 3, c: "56,189,248", o: 0.26 },
  { x: 650,  y: 610, r: 2, c: "5,150,105",  o: 0.24 },
  { x: 870,  y: 580, r: 4, c: "30,64,175",  o: 0.22 },
  { x: 1080, y: 604, r: 2, c: "56,189,248", o: 0.27 },
  { x: 16,   y: 200, r: 3, c: "56,189,248", o: 0.26 },
  { x: 22,   y: 380, r: 2, c: "5,150,105",  o: 0.23 },
  { x: 1178, y: 170, r: 2, c: "5,150,105",  o: 0.26 },
  { x: 1184, y: 350, r: 4, c: "30,64,175",  o: 0.22 },
  { x: 1172, y: 490, r: 3, c: "56,189,248", o: 0.25 },
];

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: PAD,
          background: "linear-gradient(160deg, #EFF6FF 0%, #FFFFFF 45%, #ECFDF5 100%)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Dot texture — absolutely positioned, won't disturb flex flow */}
        {DOTS.map((d, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              position: "absolute",
              left: d.x - d.r,
              top: d.y - d.r,
              width: d.r * 2,
              height: d.r * 2,
              borderRadius: "50%",
              background: `rgba(${d.c},${d.o})`,
            }}
          />
        ))}

        {/* Brand row */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 46,
              height: 46,
              borderRadius: 11,
              background: "linear-gradient(135deg, #1E40AF, #059669)",
            }}
          >
            <div style={{ display: "flex", color: "white", fontSize: 24 }}>♥</div>
          </div>
          <span
            style={{
              fontSize: 34,
              fontWeight: 600,
              color: "#1E293B",
              letterSpacing: "-0.5px",
            }}
          >
            CareSense AI
          </span>
          <div
            style={{
              display: "flex",
              fontSize: 13,
              fontWeight: 700,
              color: "white",
              background: "#1E40AF",
              padding: "3px 9px",
              borderRadius: 5,
              letterSpacing: "0.8px",
            }}
          >
            BETA
          </div>
        </div>

        {/* Focal block — grows to fill remaining space, vertically centered */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            justifyContent: "center",
            flexGrow: 1,
            gap: 20,
          }}
        >
          {/* Headline */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span
              style={{
                fontSize: 102,
                fontWeight: 800,
                color: "#0F172A",
                lineHeight: 1.05,
                letterSpacing: "-3px",
              }}
            >
              Feel sick?
            </span>
            <span
              style={{
                fontSize: 102,
                fontWeight: 800,
                fontStyle: "italic",
                color: "#059669",
                lineHeight: 1.05,
                letterSpacing: "-3px",
              }}
            >
              We&apos;ve got you.
            </span>
          </div>

          {/* Tagline */}
          <span
            style={{
              fontSize: 30,
              fontWeight: 400,
              color: "#475569",
              lineHeight: 1.4,
            }}
          >
            Home care · When to see a doctor · Providers near you
          </span>
        </div>

        {/* Bottom row */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <span style={{ fontSize: 22, color: "#94A3B8" }}>
            Free · No account needed · US only
          </span>
        </div>

        {/* Accent bar — sits flush at the absolute bottom, outside padding */}
        <div
          style={{
            display: "flex",
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 6,
            background: "linear-gradient(to right, #1E40AF, #059669)",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
