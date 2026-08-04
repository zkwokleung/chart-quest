import type { Metadata, Viewport } from "next";
import { Disclaimer } from "@/components/ui/Disclaimer";
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
      <body className="flex min-h-full flex-col">
        {children}
        {/* On every route rather than only the landing page, which is where it was until M11.
            A player who opens a link straight to 7.3 — position sizing, real contract
            specifications, actual money arithmetic — is exactly the person who should see this,
            and was the only person who did not. Hidden when printing, so it does not land in the
            middle of an exported playbook that carries its own version of the same notice. */}
        <footer className="mx-auto w-full max-w-2xl border-t border-border px-8 py-6 print:hidden">
          <Disclaimer />
        </footer>
      </body>
    </html>
  );
}
