import type { Metadata } from "next";
import { Inter, Open_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { themeInitScript } from "@/components/ThemeProvider";
import { getLocale, getT } from "@/i18n/server";

// Charte : Open Sans pour les titres et l'UI, Inter pour le texte courant
const openSans = Open_Sans({
  weight: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-open-sans",
});

const inter = Inter({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

// Pré-production (Render) : signalée à l'écran et exclue des moteurs de recherche.
const IS_PREPROD = process.env.NEXT_PUBLIC_ENV === "preprod";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: { default: "Data Afrique Hub", template: "%s | Data Afrique Hub" },
    description: t.meta.description,
    ...(IS_PREPROD ? { robots: { index: false, follow: false } } : {}),
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={`${openSans.variable} ${inter.variable} h-full`} suppressHydrationWarning>
      <head>
        {/* Pose .dark avant le premier rendu pour éviter un flash de thème clair */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="font-sans min-h-full flex flex-col bg-background text-foreground">
        <Providers locale={locale}>{children}</Providers>
        {IS_PREPROD && <PreprodBadge />}
      </body>
    </html>
  );
}

async function PreprodBadge() {
  const t = await getT();
  return (
    <div
      role="note"
      title={t.env.preprodHint}
      className="fixed bottom-3 left-3 z-[60] rounded-full bg-brand-orange px-3 py-1.5 text-xs font-bold text-ink shadow-lg pointer-events-none"
    >
      {t.env.preprod}
    </div>
  );
}
