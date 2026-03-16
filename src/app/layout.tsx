import type { Metadata } from "next";
import { Quicksand, Zen_Maru_Gothic } from "next/font/google";
import "./globals.css";

const quicksand = Quicksand({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-quicksand",
  display: "swap",
});

const zenMaru = Zen_Maru_Gothic({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-zen-maru",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Dr.D — きみの学びを、診断しよう。",
  description:
    "中高生向けAI学習診断アプリ。科目をえらんで、理解度チェック、診断クイズ、学習プラン処方！",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${quicksand.variable} ${zenMaru.variable} bg-drd-bg text-[#e6edf3] antialiased`}
        style={{ fontFamily: "'Quicksand', 'Zen Maru Gothic', sans-serif" }}
      >
        {children}
      </body>
    </html>
  );
}
