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

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function dataUrlBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1] ?? "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function buildImagePdf(pages: { jpeg: Uint8Array; width: number; height: number }[]): Blob {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [0];
  let cursor = 0;

  const push = (part: string | Uint8Array) => {
    const bytes = typeof part === "string" ? enc.encode(part) : part;
    chunks.push(bytes);
    cursor += bytes.length;
  };
  const startObject = (id: number) => {
    offsets[id] = cursor;
    push(`${id} 0 obj\n`);
  };

  const pageW = 595.28;
  const pageH = 841.89;
  const pageIds = pages.map((_, index) => 3 + index * 3);
  const imageIds = pages.map((_, index) => 4 + index * 3);
  const contentIds = pages.map((_, index) => 5 + index * 3);
  const objectCount = 2 + pages.length * 3;

  push("%PDF-1.4\n%\xFF\xFF\xFF\xFF\n");

  startObject(1);
  push("<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

  startObject(2);
  push(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>\nendobj\n`);

  pages.forEach((page, index) => {
    const pageId = pageIds[index];
    const imageId = imageIds[index];
    const contentId = contentIds[index];
    const imageName = `Im${index + 1}`;
    const content = `q\n${pageW} 0 0 ${pageH} 0 0 cm\n/${imageName} Do\nQ\n`;

    startObject(pageId);
    push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /XObject << /${imageName} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>\nendobj\n`);

    startObject(imageId);
    push(`<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpeg.length} >>\nstream\n`);
    push(page.jpeg);
    push("\nendstream\nendobj\n");

    startObject(contentId);
    push(`<< /Length ${enc.encode(content).length} >>\nstream\n${content}endstream\nendobj\n`);
  });

  const xrefAt = cursor;
  push(`xref\n0 ${objectCount + 1}\n`);
  push("0000000000 65535 f \n");
  for (let i = 1; i <= objectCount; i++) {
    push(`${String(offsets[i] ?? 0).padStart(10, "0")} 00000 n \n`);
  }
  push(`trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF`);

  const bytes = concatBytes(chunks);
  const pdfBuffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  return new Blob([pdfBuffer], { type: "application/pdf" });
}

function ellipsize(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && ctx.measureText(`${out}…`).width > maxWidth) {
    out = out.slice(0, -1);
  }
  return `${out}…`;
}

function drawCell(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  width: number,
  bold = false,
): void {
  ctx.font = `${bold ? "700 " : ""}24px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.fillText(ellipsize(ctx, text, width), x, y);
}

export function buildTransactionsPdfBlob(params: {
  transactions: Transaction[];
  categories: CategoryDefinition[];
  businessTransactions: BusinessTransaction[];
  businessUnits: BusinessUnit[];
  locale: Locale;
  periodStart: string;
  periodEnd: string;
  title: string;
}): Blob {
  const {
    transactions,
    categories,
    businessTransactions,
    businessUnits,
    locale,
    periodStart,
    periodEnd,
    title,
  } = params;
  const isRu = locale === "ru";
  const unitName = (unitId: string) =>
    businessUnits.find((unit) => unit.id === unitId)?.name ?? (isRu ? "Бизнес" : "Business");
  const rows = [
    ...transactions.map((tx) => ({
      date: formatIsoDate(tx.date, locale),
      amount: `${tx.type === "income" ? "+" : "−"}${tx.amount.toLocaleString(isRu ? "ru-RU" : "en-US")} ₽`,
      category: getCategoryLabel(tx.categoryId, categories, locale),
      note: tx.note ?? "",
    })),
    ...businessTransactions.map((tx) => ({
      date: formatIsoDate(tx.date, locale),
      amount: `${tx.kind === "operating_expense" || tx.kind === "family_withdrawal" ? "−" : "+"}${tx.amount.toLocaleString(isRu ? "ru-RU" : "en-US")} ₽`,
      category: `${isRu ? "Бизнес" : "Business"}: ${unitName(tx.unitId)}`,
      note: `${businessKindLabel(tx.kind, locale)}${tx.note ? ` — ${tx.note}` : ""}`,
    })),
  ];

  const width = 1240;
  const height = 1754;
  const margin = 72;
  const rowH = 54;
  const headerH = 190;
  const footerH = 70;
  const perPage = Math.max(1, Math.floor((height - headerH - footerH) / rowH));
  const pageCount = Math.max(1, Math.ceil(rows.length / perPage));
  const pages: { jpeg: Uint8Array; width: number; height: number }[] = [];

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#111827";
    ctx.font = "700 38px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.fillText(title, margin, 86);
    ctx.fillStyle = "#4b5563";
    ctx.font = "24px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.fillText(
      `${formatIsoDate(periodStart, locale)} — ${formatIsoDate(periodEnd, locale)} · ${rows.length} ${isRu ? "операций" : "entries"}`,
      margin,
      126,
    );

    const top = headerH;
    ctx.fillStyle = "#f3f4f6";
    ctx.fillRect(margin, top - 40, width - margin * 2, 44);
    ctx.fillStyle = "#111827";
    drawCell(ctx, isRu ? "Дата" : "Date", margin + 16, top - 11, 150, true);
    drawCell(ctx, isRu ? "Сумма" : "Amount", margin + 180, top - 11, 180, true);
    drawCell(ctx, isRu ? "Категория" : "Category", margin + 380, top - 11, 260, true);
    drawCell(ctx, isRu ? "Заметка" : "Note", margin + 660, top - 11, 480, true);

    const pageRows = rows.slice(pageIndex * perPage, pageIndex * perPage + perPage);
    pageRows.forEach((row, i) => {
      const y = top + i * rowH;
      ctx.strokeStyle = "#e5e7eb";
      ctx.beginPath();
      ctx.moveTo(margin, y + 15);
      ctx.lineTo(width - margin, y + 15);
      ctx.stroke();
      ctx.fillStyle = "#111827";
      drawCell(ctx, row.date, margin + 16, y + 52, 150);
      drawCell(ctx, row.amount, margin + 180, y + 52, 180, true);
      drawCell(ctx, row.category, margin + 380, y + 52, 260);
      drawCell(ctx, row.note, margin + 660, y + 52, 480);
    });

    ctx.fillStyle = "#6b7280";
    ctx.font = "20px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.fillText(`Просто Бюджет · ${pageIndex + 1}/${pageCount}`, margin, height - 42);
    pages.push({ jpeg: dataUrlBytes(canvas.toDataURL("image/jpeg", 0.92)), width, height });
  }

  return buildImagePdf(pages);
}

export function downloadBlobFile(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  window.setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 60_000);
}

export function downloadTextFile(filename: string, content: string, mime: string): void {
  downloadBlobFile(filename, new Blob([content], { type: mime }));
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
