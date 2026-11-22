import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Cormorant_Garamond, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ShioriProvider } from "@/context/ShioriContext";
import { MotionRoot } from "@/components/motion/MotionRoot";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { ToastContainer } from "@/components/layout/ToastContainer";
import { QuickEditModal } from "@/components/media/QuickEditModal";
import { TrailerModal } from "@/components/media/TrailerModal";
import { AuthModal } from "@/components/auth/AuthModal";
import { THEME_BOOT_SCRIPT } from "@/lib/theme";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  weight: ["400", "500", "600", "700", "800"],
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-cormorant",
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  weight: ["400", "500", "600"],
});

const SITE_URL = "https://shiori-lac.vercel.app";
const SITE_TITLE = "Shiori — Suivi Anime & Manga";
const SITE_DESCRIPTION =
  "Suivez, découvrez et organisez vos animés et mangas dans une interface nocturne d'exception. Calendrier des sorties et saisons, découverte par envies, statistiques détaillées et synchronisation bidirectionnelle AniList & Supabase.";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#07080C",
  colorScheme: "dark",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: "Shiori",
  manifest: "/manifest.json",
  title: {
    default: SITE_TITLE,
    template: "%s | Shiori",
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "Shiori",
    "suivi anime",
    "suivi manga",
    "anime tracker",
    "manga tracker",
    "calendrier anime",
    "sorties anime",
    "saisons anime",
    "simulcast anime",
    "bibliothèque anime",
    "liste anime",
    "synchronisation AniList",
    "statistiques anime",
    "découvrir des animes",
    "MyAnimeList",
    "AniList",
  ],
  authors: [{ name: "Shiori", url: SITE_URL }],
  creator: "Shiori",
  publisher: "Shiori",
  category: "entertainment",
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    title: "Shiori",
    statusBarStyle: "black-translucent",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: SITE_URL,
    siteName: "Shiori",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: "/icon-512.png",
        width: 512,
        height: 512,
        alt: "Shiori — Suivi Anime & Manga",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/icon-512.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      suppressHydrationWarning
      className={`${plusJakarta.variable} ${cormorant.variable} ${jetbrainsMono.variable} dark`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="font-sans antialiased bg-obsidian text-[#F4F3EE] min-h-screen flex flex-col">
        <ShioriProvider>
          <MotionRoot>
            <Navbar />
            <main className="flex-1">{children}</main>
            <Footer />
            <CommandPalette />
            <QuickEditModal />
            <TrailerModal />
            <AuthModal />
            <ToastContainer />
          </MotionRoot>
        </ShioriProvider>
      </body>
    </html>
  );
}
