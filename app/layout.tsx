import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Using Inter for a perfectly clean, highly legible, "app-like" aesthetic
const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "ChessMind Coach",
  description: "Minimalist AI Chess Coaching",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable}`}>
      {/* We use bg-[#312e2b] which is very close to Chess.com's dark theme background.
        It's easier on the eyes than pure black.
      */}
      <body className="font-sans text-zinc-200 antialiased bg-[#312e2b] overflow-hidden h-[100dvh]">
        {children}
      </body>
    </html>
  );
}