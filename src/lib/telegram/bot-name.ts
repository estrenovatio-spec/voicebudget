/** Имя бота без @. Preview-сборка: NEXT_PUBLIC_TG_BOT_NAME_PREVIEW (только Preview на Vercel). */
export function getTelegramBotName(): string {
  const preview = process.env.NEXT_PUBLIC_TG_BOT_NAME_PREVIEW?.trim().replace(/^@/, "");
  const prod = process.env.NEXT_PUBLIC_TG_BOT_NAME?.trim().replace(/^@/, "");
  return preview || prod || "Fin_BU_bot";
}

export function getTelegramBotMention(): string {
  return `@${getTelegramBotName()}`;
}
