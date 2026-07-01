import type { Metadata } from "next";
import Script from "next/script";
import { headers } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { Toaster } from "@/components/ui/toast";
import CookieBanner from "@/components/CookieBanner";
import AnalyticsProvider from "@/app/providers";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://sentimenta.com.br";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Sentimenta",
  description: "Análise de sentimento para redes sociais com IA",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();
  const nonce = (await headers()).get("x-nonce") || undefined;

  return (
    <html lang={locale}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
        {nonce && <meta name="csp-nonce" content={nonce} />}
        <Script nonce={nonce} src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />
      </head>
      <body className="min-h-screen font-body antialiased">
        <NextIntlClientProvider messages={messages}>
          <AnalyticsProvider>
            {children}
          </AnalyticsProvider>
          <Toaster />
          <CookieBanner />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
