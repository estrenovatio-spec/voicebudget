import { getCategoryLabel } from "@/lib/categories";
import { formatIsoDate } from "@/lib/format-date";
import type {
  BusinessAsset,
  BusinessTransaction,
  BusinessUnit,
} from "@/lib/business/types";
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

export function filterBusinessTransactionsByPeriod(
  transactions: BusinessTransaction[],
  periodStart: string,
  periodEnd: string,
): BusinessTransaction[] {
  const start = new Date(periodStart);
  const end = new Date(periodEnd);
  end.setHours(23, 59, 59, 999);
  return transactions
    .filter((tx) => {
      const d = new Date(tx.date);
      return d >= start && d <= end;
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

function escapeXmlCell(value: string | number): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function worksheet(name: string, rows: (string | number)[][]): string {
  const safeName = escapeXmlCell(name.slice(0, 31));
  const body = rows
    .map(
      (row) =>
        `<Row>${row
          .map((cell) => {
            const type = typeof cell === "number" ? "Number" : "String";
            return `<Cell><Data ss:Type="${type}">${escapeXmlCell(cell)}</Data></Cell>`;
          })
          .join("")}</Row>`,
    )
    .join("");
  return `<Worksheet ss:Name="${safeName}"><Table>${body}</Table></Worksheet>`;
}

function businessKindLabel(kind: BusinessTransaction["kind"], locale: Locale): string {
  const isRu = locale === "ru";
  switch (kind) {
    case "operating_income":
      return isRu ? "Доход бизнеса" : "Business income";
    case "operating_expense":
      return isRu ? "Расход бизнеса" : "Business expense";
    case "cushion_deposit":
      return isRu ? "В резерв бизнеса" : "Business reserve";
    case "family_withdrawal":
      return isRu ? "Вывод в семью" : "Family withdrawal";
  }
}

export function buildBudgetExcelXml(params: {
  transactions: Transaction[];
  categories: CategoryDefinition[];
  businessTransactions: BusinessTransaction[];
  businessUnits: BusinessUnit[];
  businessAssets: BusinessAsset[];
  locale: Locale;
  periodStart: string;
  periodEnd: string;
}): string {
  const {
    transactions,
    categories,
    businessTransactions,
    businessUnits,
    businessAssets,
    locale,
    periodStart,
    periodEnd,
  } = params;
  const isRu = locale === "ru";
  const unitName = (unitId: string) =>
    businessUnits.find((unit) => unit.id === unitId)?.name ?? (isRu ? "Бизнес" : "Business");

  const familyRows: (string | number)[][] = [
    isRu
      ? ["Дата", "Тип", "Сумма", "Категория", "Заметка", "Кто"]
      : ["Date", "Type", "Amount", "Category", "Note", "Owner"],
    ...transactions.map((tx) => [
      tx.date,
      tx.type === "income" ? (isRu ? "Доход" : "Income") : isRu ? "Расход" : "Expense",
      tx.amount,
      getCategoryLabel(tx.categoryId, categories, locale),
      tx.note ?? "",
      tx.owner === "partner" ? (isRu ? "Партнёр" : "Partner") : isRu ? "Я" : "Me",
    ]),
  ];

  const businessRows: (string | number)[][] = [
    isRu
      ? ["Дата", "Бизнес", "Тип", "Сумма", "Заметка"]
      : ["Date", "Business", "Type", "Amount", "Note"],
    ...businessTransactions.map((tx) => [
      tx.date,
      unitName(tx.unitId),
      businessKindLabel(tx.kind, locale),
      tx.amount,
      tx.note ?? "",
    ]),
  ];

  const projectRows: (string | number)[][] = [
    isRu
      ? ["Бизнес", "Проект/актив", "Тип", "Капитал", "Плановый доход в месяц", "Часов в месяц"]
      : ["Business", "Project/asset", "Type", "Capital", "Planned monthly income", "Hours per month"],
    ...businessAssets.map((asset) => [
      unitName(asset.unitId),
      asset.name,
      asset.type,
      asset.capitalValue,
      asset.monthlyNet,
      asset.hoursPerMonth ?? "",
    ]),
  ];

  const metaRows: (string | number)[][] = [
    [isRu ? "Период" : "Period", `${periodStart} — ${periodEnd}`],
    [isRu ? "Семейных операций" : "Family entries", transactions.length],
    [isRu ? "Бизнес-операций" : "Business entries", businessTransactions.length],
    [isRu ? "Проектов/активов" : "Projects/assets", businessAssets.length],
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
${worksheet(isRu ? "Итог" : "Summary", metaRows)}
${worksheet(isRu ? "Семья" : "Family", familyRows)}
${worksheet(isRu ? "Бизнес" : "Business", businessRows)}
${worksheet(isRu ? "Проекты" : "Projects", projectRows)}
</Workbook>`;
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
