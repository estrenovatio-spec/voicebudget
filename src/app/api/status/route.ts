import { NextResponse } from "next/server";
import { isDatabaseConfigured, prisma } from "@/lib/db";
import { isLlmConfigured } from "@/lib/llm";
import { isPaymentsConfigured } from "@/lib/payments/config";
import { listSttProviderIds } from "@/lib/stt-providers";
import {
  formatRecognitionStatus,
  nextRecognitionPhrase,
} from "@/lib/recognition-phrases";

export const dynamic = "force-dynamic";

const BUILD_TAG = "goals-sync-fix-v1";

export async function GET() {
  const telegramToken = Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim());
  const databaseUrl = isDatabaseConfigured();
  const databaseUrlHint = !databaseUrl
    ? "DATABASE_URL на Vercel пустой или неверный (должен начинаться с postgresql://)"
    : undefined;
  const sessionSecret = Boolean(
    process.env.HOUSEHOLD_SESSION_SECRET?.trim() || process.env.RATE_LIMIT_SECRET?.trim(),
  );
  const llm = isLlmConfigured();

  let dbTables = false;
  let planningTables = false;
  let dbError: string | undefined;

  if (databaseUrl) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      await prisma.household.findFirst({ take: 1 });
      dbTables = true;

      const planningRows = await prisma.$queryRaw<{ table_name: string }[]>`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN (
            'SavingsGoal',
            'CategoryBudget',
            'RecurringTransaction',
            'Subscription',
            'Payment'
          )
      `;
      planningTables = planningRows.length >= 5;
    } catch (e) {
      dbError = e instanceof Error ? e.message.slice(0, 280) : "unknown";
    }
  }

  const usesSupabaseDirect =
    Boolean(process.env.DATABASE_URL?.includes(".supabase.co:5432")) ||
    Boolean(dbError?.includes(".supabase.co:5432"));

  return NextResponse.json({
    ok: dbTables && telegramToken && llm,
    buildTag: BUILD_TAG,
    recognitionPhraseSample: formatRecognitionStatus(
      nextRecognitionPhrase("healthcheck"),
    ),
    telegramToken,
    databaseUrl,
    sessionSecret,
    llm,
    sttProviders: listSttProviderIds(),
    sttReady: listSttProviderIds().length > 0,
    paymentsConfigured: isPaymentsConfigured(),
    dbTables,
    planningTables,
    googleSheetsConfigured: Boolean(process.env.GOOGLE_SHEETS_WEBHOOK_URL?.trim()),
    dbError,
    databaseUrlHint,
    ...(usesSupabaseDirect
      ? {
          fix:
            "На Vercel замените DATABASE_URL на Transaction pooler (порт 6543, хост *.pooler.supabase.com) и добавьте ?pgbouncer=true. Затем Redeploy.",
        }
      : {}),
  });
}
