"use client";

import { ArchiveRestore } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { formatMoney } from "@/lib/format-money";
import { useBusinessStore } from "@/store/useBusinessStore";
import { useStore } from "@/store/useStore";

function formatArchiveDate(value: string, locale: "ru" | "en"): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(date);
}

export function ArchiveRestorePanel() {
  const locale = useStore((s) => s.locale);
  const categoryArchive = useStore((s) => s.deletedCategoryArchive);
  const restoreArchivedCategory = useStore((s) => s.restoreArchivedCategory);
  const businessArchive = useBusinessStore((s) => s.deletedUnitsArchive);
  const restoreDeletedUnitArchive = useBusinessStore((s) => s.restoreDeletedUnitArchive);
  const { toast } = useToast();

  const hasArchive = categoryArchive.length > 0 || businessArchive.length > 0;

  const restoreCategory = (id: string) => {
    const ok = restoreArchivedCategory(id);
    toast(
      ok
        ? locale === "ru"
          ? "Категория восстановлена"
          : "Category restored"
        : locale === "ru"
          ? "Не удалось восстановить категорию"
          : "Could not restore category",
      ok ? "success" : "error",
    );
  };

  const restoreBusiness = (id: string) => {
    const ok = restoreDeletedUnitArchive(id);
    toast(
      ok
        ? locale === "ru"
          ? "Бизнес восстановлен"
          : "Business restored"
        : locale === "ru"
          ? "Не удалось восстановить бизнес"
          : "Could not restore business",
      ok ? "success" : "error",
    );
  };

  return (
    <div className="space-y-2 rounded-lg border border-border/80 bg-background p-3">
      <div className="flex items-start gap-2">
        <ArchiveRestore className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0">
          <p className="text-sm font-medium">
            {locale === "ru" ? "Восстановление из архива" : "Restore from archive"}
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {locale === "ru"
              ? "Выберите, что вернуть: удалённую категорию или бизнес. Архив нужен как страховка от случайного удаления."
              : "Choose what to restore: a deleted category or business. The archive protects against accidental deletion."}
          </p>
        </div>
      </div>

      {!hasArchive ? (
        <p className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
          {locale === "ru" ? "Архив пока пуст." : "Archive is empty."}
        </p>
      ) : null}

      {categoryArchive.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">
            {locale === "ru" ? "Категории" : "Categories"}
          </p>
          <div className="max-h-60 space-y-1.5 overflow-y-auto pr-1">
            {categoryArchive.map((item) => (
              <div key={item.id} className="rounded-md border px-2.5 py-2 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium leading-tight">{item.category.labels.ru}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatArchiveDate(item.deletedAt, locale)} ·{" "}
                      {locale === "ru" ? "операций: " : "entries: "}
                      {item.affectedTransactions.length}
                    </p>
                    {item.category.keywords.length > 0 ? (
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        {item.category.keywords.slice(0, 6).join(", ")}
                      </p>
                    ) : null}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => restoreCategory(item.id)}>
                    {locale === "ru" ? "Вернуть" : "Restore"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {businessArchive.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">
            {locale === "ru" ? "Бизнес" : "Business"}
          </p>
          <div className="max-h-60 space-y-1.5 overflow-y-auto pr-1">
            {businessArchive.map((item) => {
              const txTotal = item.transactions.reduce((sum, tx) => sum + tx.amount, 0);
              return (
                <div key={item.id} className="rounded-md border px-2.5 py-2 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium leading-tight">{item.unit.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatArchiveDate(item.deletedAt, locale)} ·{" "}
                        {locale === "ru" ? "операций: " : "entries: "}
                        {item.transactions.length} ·{" "}
                        {locale === "ru" ? "проектов: " : "projects: "}
                        {item.assets.length} ·{" "}
                        {locale === "ru" ? "долгов: " : "debts: "}
                        {item.debts.length}
                      </p>
                      {txTotal > 0 ? (
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {locale === "ru" ? "Сумма операций: " : "Entries total: "}
                          {formatMoney(txTotal, locale)}
                        </p>
                      ) : null}
                    </div>
                    <Button size="sm" variant="outline" onClick={() => restoreBusiness(item.id)}>
                      {locale === "ru" ? "Вернуть" : "Restore"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
