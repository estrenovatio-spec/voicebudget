import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/api/household-auth";
import { isDatabaseConfigured } from "@/lib/db";
import { householdAuthBaseSchema } from "@/lib/household/auth-body";
import {
  assertMember,
  buildSyncPayload,
  getHouseholdSessionForUser,
  upsertTelegramUser,
} from "@/lib/household/service";
import {
  HELP_CHAT_LLM_HISTORY_MAX,
  HELP_CHAT_SYSTEM,
  buildHelpChatContext,
  type HelpChatMessage,
} from "@/lib/help-chat";
import { createLlmChatCompletion, getLlmClient, isLlmConfigured } from "@/lib/llm";
import { requireTelegramUser } from "@/lib/household/require-telegram-user";
import type { CategoryDefinition, Transaction } from "@/types";
import type { CategoryBudget, RecurringTransaction, SavingsGoal } from "@/types/planning";

const txSchema = z.object({
  id: z.string(),
  amount: z.number(),
  type: z.enum(["income", "expense"]),
  categoryId: z.string(),
  currency: z.string(),
  note: z.string().optional(),
  date: z.string(),
  owner: z.enum(["me", "partner"]).optional(),
  goalId: z.string().optional(),
  goalAmount: z.number().optional(),
});

const categorySchema = z.object({
  id: z.string(),
  labels: z.object({ ru: z.string(), en: z.string() }),
  keywords: z.array(z.string()).optional(),
  type: z.enum(["income", "expense", "both"]).optional(),
});

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(2000),
});

const bodySchema = z
  .object({
    locale: z.enum(["ru", "en"]),
    question: z.string().min(1).max(1000),
    messages: z.array(messageSchema).max(400),
    trackingStartedAt: z.string().nullable().optional(),
    partnerLabel: z.string().nullable().optional(),
    initData: z.string().optional(),
    telegramLogin: householdAuthBaseSchema.shape.telegramLogin,
    clientSnapshot: z
      .object({
        transactions: z.array(txSchema).max(5000),
        categories: z.array(categorySchema).max(200),
        savingsGoals: z.array(z.record(z.unknown())).optional(),
        categoryBudgets: z.array(z.record(z.unknown())).optional(),
        recurringTransactions: z.array(z.record(z.unknown())).optional(),
      })
      .optional(),
  });

async function loadSyncFromRequest(
  req: NextRequest,
  auth: { initData?: string; telegramLogin?: z.infer<typeof householdAuthBaseSchema>["telegramLogin"] },
) {
  if (!isDatabaseConfigured()) return null;

  const session = requireSession(req);
  if (session) {
    await assertMember(session.userId, session.householdId);
    return buildSyncPayload(session.householdId);
  }

  if (auth.initData?.trim() || auth.telegramLogin) {
    const tgUser = requireTelegramUser({
      initData: auth.initData,
      telegramLogin: auth.telegramLogin,
    });
    if (!tgUser) return null;
    const user = await upsertTelegramUser(tgUser);
    const row = await getHouseholdSessionForUser(user.id);
    return row?.sync ?? null;
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const json: unknown = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const {
      locale,
      question,
      messages,
      trackingStartedAt = null,
      partnerLabel = null,
      initData,
      telegramLogin,
      clientSnapshot,
    } = parsed.data;

    const isRu = locale === "ru";
    const fallbackReply = isRu
      ? "Сейчас ИИ недоступен. Попробуйте задать вопрос позже."
      : "AI is unavailable. Try again later.";

    let dataSource: "cloud_db" | "client_device" | "none" = "none";
    let transactions: Transaction[] = [];
    let categories: CategoryDefinition[] = [];
    let goals: SavingsGoal[] = [];
    let budgets: CategoryBudget[] = [];
    let recurring: RecurringTransaction[] = [];
    let effectivePartnerLabel = partnerLabel;

    const sync = await loadSyncFromRequest(request, { initData, telegramLogin });
    if (sync) {
      dataSource = "cloud_db";
      transactions = sync.transactions;
      categories = sync.categories;
      goals = sync.savingsGoals;
      budgets = sync.categoryBudgets;
      recurring = sync.recurringTransactions;
      effectivePartnerLabel = sync.household.partnerLabel ?? partnerLabel;
    } else if (clientSnapshot) {
      dataSource = "client_device";
      transactions = clientSnapshot.transactions as Transaction[];
      categories = clientSnapshot.categories as CategoryDefinition[];
      goals = (clientSnapshot.savingsGoals ?? []) as unknown as SavingsGoal[];
      budgets = (clientSnapshot.categoryBudgets ?? []) as unknown as CategoryBudget[];
      recurring = (clientSnapshot.recurringTransactions ?? []) as unknown as RecurringTransaction[];
    }

    const ctx = buildHelpChatContext({
      locale,
      dataSource,
      transactions,
      categories,
      trackingStartedAt: trackingStartedAt ?? null,
      partnerLabel: effectivePartnerLabel,
      question,
      savingsGoals: goals,
      categoryBudgets: budgets,
      recurringTransactions: recurring,
    });

    if (!isLlmConfigured()) {
      return NextResponse.json({
        success: true,
        reply: fallbackReply,
        fallback: true,
        dataSource: ctx.dataSource,
        transactionCount: transactions.length,
      });
    }

    const openai = getLlmClient();
    if (!openai) {
      return NextResponse.json({
        success: true,
        reply: fallbackReply,
        fallback: true,
        dataSource: ctx.dataSource,
      });
    }

    const system = HELP_CHAT_SYSTEM(ctx);
    const history = (messages as HelpChatMessage[])
      .slice(-HELP_CHAT_LLM_HISTORY_MAX)
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

    try {
      const completion = await createLlmChatCompletion(openai, {
        messages: [
          { role: "system", content: system },
          ...history,
          { role: "user", content: question },
        ],
        temperature: 0.45,
      });

      const reply = completion.choices[0]?.message?.content?.trim();
      if (!reply) throw new Error("Empty response");

      return NextResponse.json({
        success: true,
        reply,
        dataSource: ctx.dataSource,
        transactionCount: transactions.length,
      });
    } catch {
      return NextResponse.json({
        success: true,
        reply: fallbackReply,
        fallback: true,
        dataSource: ctx.dataSource,
      });
    }
  } catch (e) {
    console.error("[help-chat]", e);
    return NextResponse.json({ error: "Failed to answer" }, { status: 500 });
  }
}
