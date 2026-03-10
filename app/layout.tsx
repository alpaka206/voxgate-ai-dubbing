import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "readvox",
  description:
    "Google 로그인과 승인 기반 접근 제어를 통해 오디오·비디오 파일을 원하는 언어로 더빙하고 재생·다운로드할 수 있는 AI 더빙 웹앱입니다.",
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
