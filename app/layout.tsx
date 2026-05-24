import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "./components/Navbar";
import AuthGuard from "./components/AuthGuard";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Death Wish",
  description: "Death Wish raid signups",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
<body
  className="min-h-full flex flex-col"
  style={{
    background: "#05010d",
  }}
>
  <AuthGuard>
    <Navbar />

    <main style={{ flex: 1 }}>
      {children}
    </main>
  </AuthGuard>
</body>
    </html>
  );
}