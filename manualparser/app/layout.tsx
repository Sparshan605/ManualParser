// This is the "root layout" — the outer HTML shell that wraps every page.
// In Next.js, every page renders inside this.
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css"; // global CSS styles for the whole app

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});
// Load the fonts and store them as CSS variables we can use anywhere
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});
// Sets the browser tab title + description (used for SEO too)
export const metadata: Metadata = {
  title: "TTCM Sign Gallery",
  description:
    "Traffic signs parsed from the Temporary Traffic Control Manual, tagged by code and analyzed with Azure AI Vision.",
};
// The actual layout component. "children" = whatever page is currently shown.
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
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
