import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PADU Dashboard",
  description: "Portal Asesmen Dua Ciksel - SMAN 2 Cikarang Selatan",
  manifest: "/manifest.json"
};

export const viewport: Viewport = {
  themeColor: "#0b2545"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
