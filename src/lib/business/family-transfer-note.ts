/** Подпись дохода в семейном бюджете при переводе из бизнеса. */
export function familyIncomeNoteFromBusiness(
  unitName: string,
  locale: "ru" | "en",
): string {
  const name = unitName.trim() || (locale === "en" ? "business" : "бизнес");
  return locale === "en"
    ? `Income from business «${name}»`
    : `Доход из бизнеса «${name}»`;
}

/** Подпись дохода в семье при зачислении пассива из проектов/активов. */
export function familyIncomeNoteFromPassive(
  unitName: string,
  assetName: string,
  assetType: "investment" | "rental" | "freelance",
  locale: "ru" | "en",
): string {
  const biz = unitName.trim() || (locale === "en" ? "business" : "бизнес");
  const fallback =
    locale === "en"
      ? assetType === "rental"
        ? "rental"
        : assetType === "investment"
          ? "investment"
          : "project"
      : assetType === "rental"
        ? "аренда"
        : assetType === "investment"
          ? "инвестиции"
          : "проект";
  const label =
    locale === "en"
      ? assetType === "rental"
        ? "Rental"
        : assetType === "investment"
          ? "Investment"
          : "Project"
      : assetType === "rental"
        ? "Аренда"
        : assetType === "investment"
          ? "Инвестиции"
          : "Проект";
  const asset = assetName.trim() || fallback;
  return locale === "en"
    ? `${label} «${asset}» (${biz})`
    : `${label} «${asset}» (${biz})`;
}
