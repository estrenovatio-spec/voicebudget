export const SERVICE_INQUIRY_IDS = [
  "osago",
  "iszh",
  "nszh",
  "tick",
  "mortgage",
  "travel",
  "sg_advisor",
] as const;

export type ServiceInquiryId = (typeof SERVICE_INQUIRY_IDS)[number];

export function serviceInquiryTopicLabel(id: ServiceInquiryId, locale: "ru" | "en"): string {
  const ru: Record<ServiceInquiryId, string> = {
    osago: "ОСАГО",
    iszh: "ИСЖ",
    nszh: "НСЖ",
    tick: "Антиклещ",
    mortgage: "Ипотека / здоровье / недвижимость",
    travel: "Страхование путешественников",
    sg_advisor: "SG Capital — финансовый советник",
  };
  const en: Record<ServiceInquiryId, string> = {
    osago: "OSAGO",
    iszh: "Unit-linked life insurance (ISZh)",
    nszh: "Risk life insurance (NSZh)",
    tick: "Tick insurance",
    mortgage: "Mortgage / health / property",
    travel: "Travel insurance",
    sg_advisor: "SG Capital — financial advisor",
  };
  return locale === "ru" ? ru[id] : en[id];
}
