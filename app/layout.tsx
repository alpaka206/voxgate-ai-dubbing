import type { Metadata, Viewport } from "next";

import "./globals.css";

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
        url: "/readvox-mark.svg",
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
    images: ["/readvox-mark.svg"],
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
      <body>{children}</body>
    </html>
  );
}
