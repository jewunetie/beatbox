import type { Metadata } from "next";
import { Playfair_Display, JetBrains_Mono, Outfit } from "next/font/google";
import Script from "next/script";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const playfair = Playfair_Display({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const outfit = Outfit({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Beat Lab",
  description: "Tap-to-label beats over Spotify tracks.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${playfair.variable} ${jetbrains.variable} ${outfit.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Script id="spotify-iframe-bootstrap" strategy="beforeInteractive">
          {`window.__spotifyIframeApiPromise=new Promise(function(r){window.onSpotifyIframeApiReady=function(a){r(a);};});`}
        </Script>
        <Script
          src="https://open.spotify.com/embed/iframe-api/v1"
          strategy="afterInteractive"
        />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
