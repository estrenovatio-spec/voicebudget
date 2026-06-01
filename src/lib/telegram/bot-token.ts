/** Vercel: production | preview | development */
function vercelEnv(): string | undefined {
  return process.env.VERCEL_ENV?.trim() || undefined;
}

function isPreviewDeploy(): boolean {
  return vercelEnv() === "preview";
}

/**
 * Production: TELEGRAM_BOT_TOKEN
 * Preview: TELEGRAM_BOT_TOKEN_PREVIEW (если задан), иначе fallback на TELEGRAM_BOT_TOKEN
 *
 * На Vercel можно завести две переменные без конфликта:
 * - TELEGRAM_BOT_TOKEN → только Production
 * - TELEGRAM_BOT_TOKEN_PREVIEW → только Preview
 */
export function getTelegramBotToken(): string | undefined {
  const prod = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const preview = process.env.TELEGRAM_BOT_TOKEN_PREVIEW?.trim();
  if (isPreviewDeploy() && preview) return preview;
  return prod || preview || undefined;
}

export function isTelegramBotConfigured(): boolean {
  return Boolean(getTelegramBotToken());
}
