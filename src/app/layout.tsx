import type { Metadata } from "next";
import { Noto_Sans_Arabic } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/components/providers/app-provider";
import { HydrationSafeProvider } from "@/components/providers/hydration-safe-provider";
import { Toaster } from "@/components/ui/sonner";
import { PWAInitializer } from "@/components/providers/pwa-provider";
import { SafeProvider } from "@/components/providers/safe-provider";
import { NotificationToastListener } from "@/components/common/notification-toast";

const notoArabic = Noto_Sans_Arabic({
  variable: "--font-noto-arabic",
  subsets: ["arabic"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "عافيتك | Aafiatak",
  description: "منصة عافيتك للرعاية الصحية المنزلية - تربط المستفيدين بالممرضين المعتمدين في اليمن",
  keywords: ["عافيتك", "رعاية صحية", "تمريض منزلي", "اليمن", "صحة", "ممرض", "استشارات طبية"],
  authors: [{ name: "عافيتك" }],
  icons: {
    icon: "/favicon.ico",
    apple: "/icons/icon-192x192.png",
  },
  manifest: "/manifest.json",
  openGraph: {
    title: "عافيتك | Aafiatak",
    description: "منصة الرعاية الصحية المنزلية في اليمن",
    type: "website",
    locale: "ar_YE",
    siteName: "عافيتك",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#7c3aed" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="عافيتك" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        {/* Prefetch hint for faster navigation */}
        <link rel="dns-prefetch" href="https://fonts.gstatic.com" />
      </head>
      <body
        className={`${notoArabic.variable} antialiased bg-background text-foreground font-sans`}
      >
        <AppProvider>
          <HydrationSafeProvider>
            <SafeProvider>
              <PWAInitializer />
              <NotificationToastListener />
            </SafeProvider>
            {children}
          </HydrationSafeProvider>
        </AppProvider>
        <Toaster
          position="top-left"
          dir="rtl"
          toastOptions={{
            className: "text-right font-sans",
            style: { fontFamily: 'var(--font-noto-arabic)' },
          }}
        />
      </body>
    </html>
  );
}
