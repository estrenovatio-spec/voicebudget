import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api/household-auth";
import { buildBudgetExcelXml, filterBusinessTransactionsByPeriod, filterTransactionsByPeriod } from "@/lib/export/transactions-export";
import { fetchUserBusinessPayload } from "@/lib/business/db";
import { isDatabaseConfigured } from "@/lib/db";
import { buildSyncPayload, assertMember } from "@/lib/household/service";
import type { Locale, Transaction, CategoryDefinition } from "@/types";
import type { BusinessTransaction, BusinessUnit } from "@/lib/business/types";
import { getCategoryLabel } from "@/lib/categories";

export const dynamic = "force-dynamic";

function sessionFromRequest(req: NextRequest) {
  const headerSession = requireSession(req);
  if (headerSession) return headerSession;
  const token = req.nextUrl.searchParams.get("token")?.trim();
  if (!token) return null;
  const authReq = new NextRequest(req.url, {
    headers: { authorization: `Bearer ${token}` },
  });
  return requireSession(authReq);
}

function safeFilename(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(0, 120);
}

function encodeContentDisposition(filename: string): string {
  return `attachment; filename="${safeFilename(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

function translit(input: string): string {
  const map: Record<string, string> = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y",
    к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
    х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
  };
  return input.replace(/[а-яё]/gi, (ch) => {
    const lower = ch.toLowerCase();
    const next = map[lower] ?? ch;
    return ch === lower ? next : next.toUpperCase();
  });
}

function pdfEscape(input: string): string {
  return translit(input)
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
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

function makePdf(params: {
  transactions: Transaction[];
  categories: CategoryDefinition[];
  businessTransactions: BusinessTransaction[];
  businessUnits: BusinessUnit[];
  locale: Locale;
  periodStart: string;
  periodEnd: string;
}): Buffer {
  const isRu = params.locale === "ru";
  const unitName = (unitId: string) =>
    params.businessUnits.find((unit) => unit.id === unitId)?.name ?? (isRu ? "Бизнес" : "Business");
  const rows = [
    ...params.transactions.map((tx) => [
      tx.date,
      `${tx.type === "income" ? "+" : "-"}${tx.amount} RUB`,
      getCategoryLabel(tx.categoryId, params.categories, params.locale),
      tx.note ?? "",
    ]),
    ...params.businessTransactions.map((tx) => [
      tx.date,
      `${tx.kind === "operating_expense" || tx.kind === "family_withdrawal" ? "-" : "+"}${tx.amount} RUB`,
      `${isRu ? "Бизнес" : "Business"}: ${unitName(tx.unitId)}`,
      `${businessKindLabel(tx.kind, params.locale)}${tx.note ? ` - ${tx.note}` : ""}`,
    ]),
  ];
  const lines = [
    "Prosto Budget",
    `${params.periodStart} - ${params.periodEnd}`,
    `${isRu ? "Operatsiy" : "Entries"}: ${rows.length}`,
    "",
    ...(rows.length
      ? rows.map((row) => `${row[0]} | ${row[1]} | ${row[2]} | ${row[3]}`.slice(0, 112))
      : [isRu ? "Za vybrannyy period operatsiy net" : "No entries for selected period"]),
  ];

  const pageW = 595;
  const pageH = 842;
  const margin = 40;
  const lineH = 14;
  const perPage = Math.max(1, Math.floor((pageH - margin * 2) / lineH));
  const pages = Array.from({ length: Math.max(1, Math.ceil(lines.length / perPage)) }, (_, index) =>
    lines.slice(index * perPage, index * perPage + perPage),
  );

  const objects: string[] = [];
  const add = (body: string) => {
    objects.push(body);
    return objects.length;
  };
  const fontId = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const pageIds: number[] = [];
  for (const pageLines of pages) {
    const content = [
      "BT",
      "/F1 10 Tf",
      `${margin} ${pageH - margin} Td`,
      ...pageLines.flatMap((line, index) => [
        index === 0 ? "" : `0 -${lineH} Td`,
        `(${pdfEscape(line)}) Tj`,
      ]).filter(Boolean),
      "ET",
    ].join("\n");
    const contentId = add(`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`);
    const pageId = add(`<< /Type /Page /Parent 0 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    pageIds.push(pageId);
  }
  const pagesId = add(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`);
  const catalogId = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  for (const pageId of pageIds) {
    objects[pageId - 1] = objects[pageId - 1].replace("/Parent 0 0 R", `/Parent ${pagesId} 0 R`);
  }

  const chunks: string[] = ["%PDF-1.4\n"];
  const offsets = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets[i + 1] = Buffer.byteLength(chunks.join(""));
    chunks.push(`${i + 1} 0 obj\n${objects[i]}\nendobj\n`);
  }
  const xref = Buffer.byteLength(chunks.join(""));
  chunks.push(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`);
  for (let i = 1; i <= objects.length; i++) {
    chunks.push(`${String(offsets[i]).padStart(10, "0")} 00000 n \n`);
  }
  chunks.push(`trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return Buffer.from(chunks.join(""), "binary");
}

export async function GET(req: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "db_unavailable" }, { status: 503 });
  }

  const session = sessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const type = req.nextUrl.searchParams.get("type") === "pdf" ? "pdf" : "xls";
  const locale: Locale = req.nextUrl.searchParams.get("locale") === "en" ? "en" : "ru";
  const from = req.nextUrl.searchParams.get("from")?.slice(0, 10) || new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
  const to = req.nextUrl.searchParams.get("to")?.slice(0, 10) || new Date().toISOString().slice(0, 10);

  await assertMember(session.userId, session.householdId);
  const [sync, business] = await Promise.all([
    buildSyncPayload(session.householdId, session.userId),
    fetchUserBusinessPayload(session.userId),
  ]);
  const transactions = filterTransactionsByPeriod(sync.transactions, from, to);
  const businessTransactions = filterBusinessTransactionsByPeriod(business?.transactions ?? [], from, to);
  const businessUnits = business?.units ?? [];
  const businessAssets = business?.assets ?? [];
  const base = `prosto-budget-${from}_${to}`;

  if (type === "pdf") {
    const pdf = makePdf({
      transactions,
      categories: sync.categories,
      businessTransactions,
      businessUnits,
      locale,
      periodStart: from,
      periodEnd: to,
    });
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": encodeContentDisposition(`${base}.pdf`),
        "Cache-Control": "no-store",
      },
    });
  }

  const xls = buildBudgetExcelXml({
    transactions,
    categories: sync.categories,
    businessTransactions,
    businessUnits,
    businessAssets,
    locale,
    periodStart: from,
    periodEnd: to,
  });
  return new NextResponse(xls, {
    headers: {
      "Content-Type": "application/vnd.ms-excel; charset=utf-8",
      "Content-Disposition": encodeContentDisposition(`${base}.xls`),
      "Cache-Control": "no-store",
    },
  });
}
