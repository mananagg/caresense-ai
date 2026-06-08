import type { Metadata, Viewport } from "next";
import { Instrument_Sans, Fraunces } from "next/font/google";
import { SpeedInsights } from '@vercel/speed-insights/next';
import "./globals.css";

const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-instrument",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["800"],
  style: ["normal", "italic"],
  variable: "--font-fraunces",
});

const DOC_TITLE = "CareSense AI — Feel sick? We've got you.";
const OG_TITLE = "CareSense - Your Friendly Health Companion";
const OG_DESC = "Tell us how you're feeling and get instant guidance - including home care, specialist recommendations, and providers near you.";

export const metadata: Metadata = {
  metadataBase: new URL("https://caresense-ai.vercel.app"),
  title: DOC_TITLE,
  description: OG_DESC,
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "CareSense AI",
  },
  openGraph: {
    title: OG_TITLE,
    description: OG_DESC,
    url: "https://caresense-ai.vercel.app",
    siteName: "CareSense AI",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: OG_TITLE,
    description: OG_DESC,
  },
};

export const viewport: Viewport = {
  themeColor: "#2D6A4F",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${instrumentSans.variable} ${fraunces.variable} h-full antialiased`}>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="CareSense AI" />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <SpeedInsights />
        <script dangerouslySetInnerHTML={{
          __html: `if('serviceWorker'in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js');});}`
        }} />
      </body>
    </html>
  );
}
