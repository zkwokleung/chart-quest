import type { Metadata, Viewport } from "next";
import "./globals.css";

const TAGLINE = "Learn to read any market, one level at a time.";

export const metadata: Metadata = {
  title: { default: "Chart Quest", template: "%s · Chart Quest" },
  description: TAGLINE,
  applicationName: "Chart Quest",
  openGraph: {
    title: "Chart Quest",
    description: TAGLINE,
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0e14",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
