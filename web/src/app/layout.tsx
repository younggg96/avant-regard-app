import type { Metadata, Viewport } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { EngagementNudgeProvider } from "@/components/EngagementNudgeProvider";
import { ThemePreferenceSync } from "@/components/ThemePreferenceSync";
import { config } from "@/lib/config";
import { I18nProvider } from "@/lib/i18n/I18nProvider";
import { getServerLanguage, getServerT } from "@/lib/i18n/server";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["300", "400", "500", "600"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const t = getServerT();
  return {
    metadataBase: new URL(config.siteUrl),
    title: {
      default: t("meta.siteTitle"),
      template: "%s · Avant Regard",
    },
    description: t("meta.siteDescription"),
    keywords: [
      "Avant Regard",
      "avant-garde fashion",
      "designer brands",
      "boutique",
      "fashion community",
    ],
    openGraph: {
      type: "website",
      locale: getServerLanguage() === "zh" ? "zh_CN" : "en_US",
      url: config.siteUrl,
      siteName: "Avant Regard",
      title: t("meta.ogTitle"),
      description: t("meta.ogDescription"),
    },
    twitter: {
      card: "summary_large_image",
      title: "Avant Regard",
      description: t("meta.twitterDescription"),
    },
    icons: {
      icon: "/logo.jpg",
      apple: "/logo.jpg",
    },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)",  color: "#0a0a0a" },
  ],
  colorScheme: "light dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = getServerLanguage();

  return (
    <html
      lang={lang === "zh" ? "zh-CN" : "en"}
      className={`${playfair.variable} ${inter.variable}`}
      suppressHydrationWarning={true}
    >
      <body className="flex min-h-screen flex-col antialiased">
        <I18nProvider>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange={false}>
            <SiteHeader />
            <main className="flex-1">{children}</main>
            <SiteFooter />
            <ThemePreferenceSync />
            <EngagementNudgeProvider />
          </ThemeProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
