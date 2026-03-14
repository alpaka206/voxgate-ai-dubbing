import type { Metadata, Viewport } from "next";
import { Roboto } from "next/font/google";

import "./globals.css";

const googleButtonFont = Roboto({
  subsets: ["latin"],
  variable: "--font-google-signin",
  weight: "500",
});

const siteUrl = "https://readvox.vercel.app";
const description =
  "Upload audio or video, transcribe with ElevenLabs, translate with Gemini, and return dubbed output in your target language.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "readvox",
    template: "%s | readvox",
  },
  description,
  applicationName: "readvox",
  keywords: [
    "readvox",
    "ai dubbing",
    "video dubbing",
    "audio dubbing",
    "elevenlabs",
    "gemini",
    "next.js",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "readvox",
    description,
    locale: "ko_KR",
    siteName: "readvox",
    type: "website",
    url: siteUrl,
    images: [
      {
        url: "/readvox-og.svg",
        width: 1200,
        height: 630,
        alt: "readvox AI dubbing workspace",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "readvox",
    description,
    images: ["/readvox-og.svg"],
  },
  icons: {
    icon: "/readvox-mark.svg",
    shortcut: "/readvox-mark.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#fff7ef",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={googleButtonFont.variable}>{children}</body>
    </html>
  );
}
