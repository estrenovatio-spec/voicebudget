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
  locale: "ru" | "en",
): string {
  const biz = unitName.trim() || (locale === "en" ? "business" : "бизнес");
  const asset = assetName.trim() || (locale === "en" ? "passive income" : "пассив");
  return locale === "en"
    ? `Passive «${asset}» (${biz})`
    : `Пассив «${asset}» (${biz})`;
}
