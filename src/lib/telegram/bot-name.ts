/** Имя бота без @ — из NEXT_PUBLIC_TG_BOT_NAME или Fin_BU_bot */
export function getTelegramBotName(): string {
  const fromEnv = process.env.NEXT_PUBLIC_TG_BOT_NAME?.trim().replace(/^@/, "");
  return fromEnv || "Fin_BU_bot";
}

export function getTelegramBotMention(): string {
  return `@${getTelegramBotName()}`;
}
