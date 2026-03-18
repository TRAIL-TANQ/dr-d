import type { Metadata } from "next";
import { Noto_Sans_JP, Quicksand } from "next/font/google";
import "./globals.css";

const notoSansJP = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto-sans-jp",
  display: "swap",
});

const quicksand = Quicksand({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-quicksand",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Dr.D — きみの学びを、診断しよう。",
  description:
    "小中高生向けAI学習診断アプリ。科目をえらんで、理解度チェック、診断クイズ、学習プラン処方！",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${notoSansJP.variable} ${quicksand.variable} bg-[#FFF9F0] text-[#2D2D2D] antialiased`}
        style={{ fontFamily: "'Noto Sans JP', 'Quicksand', sans-serif" }}
      >
        {children}
      </body>
    </html>
  );
}
