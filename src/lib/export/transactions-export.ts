import { getCategoryLabel } from "@/lib/categories";
import { formatIsoDate } from "@/lib/format-date";
import type { CategoryDefinition, Locale, Transaction } from "@/types";

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function filterTransactionsByPeriod(
  transactions: Transaction[],
  periodStart: string,
  periodEnd: string,
): Transaction[] {
  const start = new Date(periodStart);
  const end = new Date(periodEnd);
  end.setHours(23, 59, 59, 999);
  return transactions
    .filter((tx) => {
      const d = new Date(tx.date);
      return d >= start && d <= end && tx.confirmed !== false;
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function buildTransactionsCsv(
  transactions: Transaction[],
  categories: CategoryDefinition[],
  locale: Locale,
): string {
  const header =
    locale === "ru"
      ? ["Дата", "Тип", "Сумма", "Категория", "Заметка", "Кто"].join(",")
      : ["Date", "Type", "Amount", "Category", "Note", "Owner"].join(",");

  const rows = transactions.map((tx) => {
    const type =
      tx.type === "income"
        ? locale === "ru"
          ? "Доход"
          : "Income"
        : locale === "ru"
          ? "Расход"
          : "Expense";
    const owner =
      tx.owner === "partner"
        ? locale === "ru"
          ? "Партнёр"
          : "Partner"
        : locale === "ru"
          ? "Я"
          : "Me";
    return [
      tx.date,
      type,
      String(tx.amount),
      getCategoryLabel(tx.categoryId, categories, locale),
      tx.note ?? "",
      owner,
    ]
      .map(escapeCsvCell)
      .join(",");
  });

  return `\uFEFF${header}\n${rows.join("\n")}`;
}

export function downloadTextFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function openTransactionsPdfPrint(params: {
  transactions: Transaction[];
  categories: CategoryDefinition[];
  locale: Locale;
  periodStart: string;
  periodEnd: string;
  title: string;
}): void {
  const { transactions, categories, locale, periodStart, periodEnd, title } = params;
  const rows = transactions
    .map((tx) => {
      const type = tx.type === "income" ? "+" : "−";
      const cat = getCategoryLabel(tx.categoryId, categories, locale);
      const note = tx.note?.trim() ? ` — ${tx.note}` : "";
      return `<tr>
        <td>${formatIsoDate(tx.date, locale)}</td>
        <td>${type}${tx.amount.toLocaleString(locale === "ru" ? "ru-RU" : "en-US")} ₽</td>
        <td>${cat}</td>
        <td>${note}</td>
      </tr>`;
    })
    .join("");

  const periodLabel = `${formatIsoDate(periodStart, locale)} — ${formatIsoDate(periodEnd, locale)}`;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${title}</title>
<style>
body{font-family:system-ui,sans-serif;padding:24px;color:#111}
h1{font-size:18px;margin:0 0 4px}
p{color:#555;font-size:12px;margin:0 0 16px}
table{width:100%;border-collapse:collapse;font-size:11px}
th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}
th{background:#f5f5f5}
@media print{body{padding:12px}}
</style></head><body>
<h1>${title}</h1>
<p>${periodLabel} · ${transactions.length} ${locale === "ru" ? "записей" : "entries"}</p>
<table><thead><tr>
<th>${locale === "ru" ? "Дата" : "Date"}</th>
<th>${locale === "ru" ? "Сумма" : "Amount"}</th>
<th>${locale === "ru" ? "Категория" : "Category"}</th>
<th>${locale === "ru" ? "Заметка" : "Note"}</th>
</tr></thead><tbody>${rows}</tbody></table>
<script>window.onload=function(){window.print()}</script>
</body></html>`;

  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
}
