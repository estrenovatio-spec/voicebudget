import type { Metadata } from "next";
import Script from "next/script";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { DeployResilience } from "@/components/DeployResilience";
import { TelegramInit } from "@/components/TelegramInit";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "Просто Бюджет",
  description: "Учёт бюджета в Telegram Mini App",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body>
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
        <ToastProvider>
          <ErrorBoundary>
            <DeployResilience />
            <TelegramInit />
            {children}
          </ErrorBoundary>
        </ToastProvider>
      </body>
    </html>
  );
}
