import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tandwielenlab — Bouw. Test. Ontdek.",
  description: "Digitaal STEM-laboratorium: bouw tandwielmachines en kettingoverbrengingen, voorspel, test en meet.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0f172a",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="nl">
      <body className="antialiased">{children}</body>
    </html>
  );
}
