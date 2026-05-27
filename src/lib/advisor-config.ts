export interface AdvisorConfig {
  name: string;
  contact: string;
}

export function getAdvisorConfig(): AdvisorConfig {
  const name =
    process.env.ADVISOR_NAME?.trim() ||
    process.env.NEXT_PUBLIC_ADVISOR_NAME?.trim() ||
    "ваш финансовый консультант";
  const contact =
    process.env.ADVISOR_CONTACT?.trim() ||
    process.env.NEXT_PUBLIC_ADVISOR_CONTACT?.trim() ||
    "Telegram: @your_username";
  return { name, contact };
}
