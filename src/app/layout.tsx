import type { Metadata } from "next";
import Script from "next/script";
import { Inter } from "next/font/google";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { TelegramInit } from "@/components/TelegramInit";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "cyrillic"] });

export const metadata: Metadata = {
  title: "VoiceBudget",
  description: "Voice-powered budget tracker for Telegram Mini App",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className={inter.className}>
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="lazyOnload" />
        <ToastProvider>
          <ErrorBoundary>
            <TelegramInit />
            {children}
          </ErrorBoundary>
        </ToastProvider>
      </body>
    </html>
  );
}
