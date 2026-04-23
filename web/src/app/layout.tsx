import type { Metadata, Viewport } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { config } from "@/lib/config";

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

export const metadata: Metadata = {
  metadataBase: new URL(config.siteUrl),
  title: {
    default: "Avant Regard — 为先锋时装而生的社区",
    template: "%s · Avant Regard",
  },
  description:
    "Avant Regard 是面向先锋时装爱好者的社区：发现设计师品牌、浏览秀场、分享穿搭与单品测评。",
  keywords: [
    "Avant Regard",
    "先锋时装",
    "设计师品牌",
    "买手店",
    "穿搭社区",
    "秀场",
    "单品测评",
  ],
  openGraph: {
    type: "website",
    locale: "zh_CN",
    url: config.siteUrl,
    siteName: "Avant Regard",
    title: "Avant Regard — 为先锋时装而生的社区",
    description:
      "发现设计师品牌、浏览秀场、穿搭与单品测评的社区。",
  },
  twitter: {
    card: "summary_large_image",
    title: "Avant Regard",
    description: "为先锋时装而生的社区",
  },
  icons: {
    icon: "/logo.jpg",
    apple: "/logo.jpg",
  },
};

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
  return (
    <html
      lang="zh-CN"
      className={`${playfair.variable} ${inter.variable}`}
      suppressHydrationWarning
    >
      <body className="flex min-h-screen flex-col antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange={false}>
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </ThemeProvider>
      </body>
    </html>
  );
}
