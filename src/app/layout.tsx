import type { Metadata, Viewport } from "next";
import { Geist, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Board C's pairing: Geist for prose and UI, JetBrains Mono for every figure.
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const jetbrainsMono = JetBrains_Mono({ variable: "--font-jetbrains-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Headshot",
  description: "The shared brain of who was in what with whom.",
  // Thread views are personal and not indexable; answer permalinks under /a override this.
  robots: { index: false, follow: true },
};

export const viewport: Viewport = { themeColor: "#0d0d0e" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${jetbrainsMono.variable} h-full antialiased`}>
      <body className="h-full font-sans">{children}</body>
    </html>
  );
}
