import type { Metadata, Viewport } from "next";
import { sans, mono, serif } from "@/app/fonts";
import { ThemeProvider } from "@/components/brand/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  ),
  title: {
    default: "TravelMind AI — Trips planned by a team of agents",
    template: "%s · TravelMind AI",
  },
  description:
    "Watch flights, hotels, weather and budget get researched live. Review the plan, change any day, then approve.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${sans.variable} ${mono.variable} ${serif.variable}`}
    >
      <body className="min-h-[100dvh] bg-[var(--bg)] text-[var(--text)] antialiased">
        <ThemeProvider>
          {children}
          <Toaster position="bottom-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
