import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "CareSense AI — Feel sick? We've got you.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const PAD = 70;

// Deterministic dot scatter for texture — kept to edges so they don't crowd the headline
const DOTS: Array<{ x: number; y: number; r: number; c: string; o: number }> = [
  // Top strip
  { x: 50,   y: 28,  r: 3, c: "30,64,175",  o: 0.32 },
  { x: 160,  y: 14,  r: 2, c: "56,189,248", o: 0.28 },
  { x: 290,  y: 38,  r: 4, c: "5,150,105",  o: 0.25 },
  { x: 440,  y: 18,  r: 2, c: "30,64,175",  o: 0.30 },
  { x: 590,  y: 42,  r: 3, c: "56,189,248", o: 0.26 },
  { x: 740,  y: 12,  r: 2, c: "5,150,105",  o: 0.28 },
  { x: 880,  y: 36,  r: 4, c: "30,64,175",  o: 0.24 },
  { x: 1020, y: 20,  r: 3, c: "56,189,248", o: 0.30 },
  { x: 1140, y: 44,  r: 2, c: "5,150,105",  o: 0.27 },
  // Bottom strip
  { x: 30,   y: 590, r: 2, c: "5,150,105",  o: 0.30 },
  { x: 160,  y: 606, r: 4, c: "30,64,175",  o: 0.25 },
  { x: 320,  y: 582, r: 3, c: "56,189,248", o: 0.28 },
  { x: 500,  y: 612, r: 2, c: "5,150,105",  o: 0.26 },
  { x: 660,  y: 585, r: 4, c: "30,64,175",  o: 0.24 },
  { x: 820,  y: 608, r: 2, c: "56,189,248", o: 0.30 },
  { x: 990,  y: 578, r: 3, c: "5,150,105",  o: 0.27 },
  { x: 1130, y: 600, r: 2, c: "30,64,175",  o: 0.28 },
  // Left strip
  { x: 18,   y: 180, r: 3, c: "56,189,248", o: 0.28 },
  { x: 28,   y: 320, r: 2, c: "5,150,105",  o: 0.25 },
  { x: 14,   y: 460, r: 4, c: "30,64,175",  o: 0.24 },
  // Right strip
  { x: 1174, y: 160, r: 2, c: "5,150,105",  o: 0.28 },
  { x: 1182, y: 300, r: 4, c: "56,189,248", o: 0.24 },
  { x: 1170, y: 440, r: 3, c: "30,64,175",  o: 0.27 },
];

async function fetchFraunces(style: "normal" | "italic"): Promise<ArrayBuffer | null> {
  try {
    const ital = style === "italic" ? "1" : "0";
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@${ital},9..144,800&display=swap`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      }
    ).then((r) => r.text());
    const match = css.match(/src:\s*url\(([^)]+)\)/);
    if (!match) return null;
    return fetch(match[1]).then((r) => r.arrayBuffer());
  } catch {
    return null;
  }
}

export default async function OGImage() {
  const [frauncesNormal, frauncesItalic] = await Promise.all([
    fetchFraunces("normal"),
    fetchFraunces("italic"),
  ]);

  type FontDef = { name: string; data: ArrayBuffer; weight: 800; style: "normal" | "italic" };
  const fonts: FontDef[] = [];
  if (frauncesNormal) fonts.push({ name: "Fraunces", data: frauncesNormal, weight: 800, style: "normal" });
  if (frauncesItalic) fonts.push({ name: "Fraunces", data: frauncesItalic, weight: 800, style: "italic" });
  const serif = fonts.length > 0 ? "Fraunces" : "Georgia, serif";

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

        {/* Brand row — top-left */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: 11,
              background: "linear-gradient(135deg, #1E40AF, #059669)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontSize: 24,
            }}
          >
            ♥
          </div>
          <span
            style={{
              fontSize: 34,
              fontWeight: 600,
              color: "#1E293B",
              letterSpacing: "-0.5px",
              fontFamily: "system-ui, sans-serif",
            }}
          >
            CareSense AI
          </span>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "white",
              background: "#1E40AF",
              padding: "3px 9px",
              borderRadius: 5,
              letterSpacing: "0.8px",
              fontFamily: "system-ui, sans-serif",
            }}
          >
            BETA
          </div>
        </div>

        {/* Focal block — vertically centered in remaining space */}
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
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            <span
              style={{
                fontSize: 102,
                fontWeight: 800,
                fontFamily: serif,
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
                fontFamily: serif,
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
              color: "#475569",
              lineHeight: 1.4,
              fontFamily: "system-ui, sans-serif",
              fontWeight: 400,
            }}
          >
            Home care · When to see a doctor · Providers near you
          </span>
        </div>

        {/* Bottom row */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <span
            style={{
              fontSize: 22,
              color: "#94A3B8",
              fontFamily: "system-ui, sans-serif",
            }}
          >
            Free · No account needed · US only
          </span>
        </div>

        {/* Accent bar */}
        <div
          style={{
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
    {
      ...size,
      fonts: fonts.length > 0 ? fonts : undefined,
    }
  );
}
