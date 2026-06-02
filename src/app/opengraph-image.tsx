import { ImageResponse } from "next/og";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";
export const alt = "CareSense AI — Feel sick? We've got you.";
export const size = { width: 2400, height: 1260 };
export const contentType = "image/png";

const PAD = 140;

const DOTS: Array<{ x: number; y: number; r: number; c: string; o: number }> = [
  { x: 100,  y: 56,   r: 6,  c: "30,64,175",  o: 0.30 },
  { x: 400,  y: 28,   r: 4,  c: "56,189,248", o: 0.26 },
  { x: 760,  y: 72,   r: 8,  c: "5,150,105",  o: 0.23 },
  { x: 1120, y: 36,   r: 4,  c: "30,64,175",  o: 0.28 },
  { x: 1480, y: 80,   r: 6,  c: "56,189,248", o: 0.24 },
  { x: 1840, y: 32,   r: 4,  c: "5,150,105",  o: 0.26 },
  { x: 2200, y: 76,   r: 6,  c: "30,64,175",  o: 0.22 },
  { x: 60,   y: 1184, r: 4,  c: "5,150,105",  o: 0.28 },
  { x: 420,  y: 1216, r: 8,  c: "30,64,175",  o: 0.23 },
  { x: 860,  y: 1168, r: 6,  c: "56,189,248", o: 0.26 },
  { x: 1300, y: 1220, r: 4,  c: "5,150,105",  o: 0.24 },
  { x: 1740, y: 1160, r: 8,  c: "30,64,175",  o: 0.22 },
  { x: 2160, y: 1208, r: 4,  c: "56,189,248", o: 0.27 },
  { x: 32,   y: 400,  r: 6,  c: "56,189,248", o: 0.26 },
  { x: 44,   y: 760,  r: 4,  c: "5,150,105",  o: 0.23 },
  { x: 28,   y: 1040, r: 8,  c: "30,64,175",  o: 0.24 },
  { x: 2356, y: 320,  r: 4,  c: "5,150,105",  o: 0.26 },
  { x: 2368, y: 700,  r: 8,  c: "56,189,248", o: 0.24 },
  { x: 2344, y: 980,  r: 6,  c: "30,64,175",  o: 0.27 },
];

export default function OGImage() {
  const frauncesBold = fs.readFileSync(
    path.join(process.cwd(), "public/fonts/Fraunces-Bold.ttf")
  );
  const frauncesBoldItalic = fs.readFileSync(
    path.join(process.cwd(), "public/fonts/Fraunces-BoldItalic.ttf")
  );

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
        {/* Dot texture */}
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
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 92,
              height: 92,
              borderRadius: 22,
              background: "linear-gradient(135deg, #1E40AF, #059669)",
            }}
          >
            <div style={{ display: "flex", color: "white", fontSize: 48 }}>♥</div>
          </div>
          <span style={{ fontSize: 68, fontWeight: 600, color: "#1E293B", letterSpacing: "-1px" }}>
            CareSense AI
          </span>
          <div
            style={{
              display: "flex",
              fontSize: 26,
              fontWeight: 700,
              color: "white",
              background: "#1E40AF",
              padding: "6px 18px",
              borderRadius: 10,
              letterSpacing: "1.6px",
            }}
          >
            BETA
          </div>
        </div>

        {/* Focal block */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            justifyContent: "center",
            flexGrow: 1,
            gap: 40,
          }}
        >
          {/* Headline */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span
              style={{
                fontSize: 204,
                fontWeight: 800,
                fontFamily: "Fraunces",
                fontStyle: "normal",
                color: "#0F172A",
                lineHeight: 1.05,
                letterSpacing: "-6px",
              }}
            >
              Feel sick?
            </span>
            <span
              style={{
                fontSize: 204,
                fontWeight: 800,
                fontFamily: "Fraunces",
                fontStyle: "italic",
                color: "#059669",
                lineHeight: 1.05,
                letterSpacing: "-6px",
              }}
            >
              We&apos;ve got you.
            </span>
          </div>

          {/* Tagline */}
          <span
            style={{
              fontSize: 60,
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
          <span style={{ fontSize: 44, color: "#94A3B8" }}>
            Free · No account needed · US only
          </span>
        </div>

        {/* Accent bar */}
        <div
          style={{
            display: "flex",
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 12,
            background: "linear-gradient(to right, #1E40AF, #059669)",
          }}
        />
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Fraunces", data: frauncesBold, weight: 800, style: "normal" },
        { name: "Fraunces", data: frauncesBoldItalic, weight: 800, style: "italic" },
      ],
    }
  );
}
