import type { Metadata } from "next";
import Script from "next/script";
import { Toaster } from "@/components/ui/toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sentimenta - Social Media Sentiment Analysis",
  description:
    "Analyze the sentiment of your social media comments with AI-powered insights.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <head>
        <Script
          src="https://accounts.google.com/gsi/client"
          strategy="beforeInteractive"
        />
      </head>
      <body className="min-h-screen bg-background text-text-primary">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
