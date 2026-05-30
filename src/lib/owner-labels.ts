import { t } from "@/lib/i18n";
import type { Locale } from "@/types";

/** Подпись строки «мои» операции / баланс — из настроек, иначе «Я». */
export function myDisplayName(locale: Locale, userName: string | null | undefined): string {
  const trimmed = userName?.trim();
  return trimmed || t(locale, "ownerMe");
}

/** Подпись операций партнёра — только из настроек на этом устройстве. */
export function partnerDisplayName(partnerName: string | null | undefined): string {
  return partnerName?.trim() ?? "";
}

export function hasPartnerBudget(partnerName: string | null | undefined): boolean {
  return Boolean(partnerDisplayName(partnerName));
}
