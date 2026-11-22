import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "Shiori (栞) — Plateforme Premium de Suivi Anime & Manga",
  description:
    "Suivez, découvrez et archivez vos animés et mangas dans une interface nocturne d'exception. Calendrier hebdomadaire, statistiques détaillées et synchronisation Supabase.",
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
