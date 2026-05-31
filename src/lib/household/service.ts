import type { HouseholdMode } from "@prisma/client";
import { normalizeAppCurrency } from "@/lib/app-currency";
import { getDefaultCategories, getFallbackCategoryId } from "@/lib/categories";
import { prisma } from "@/lib/db";
import { assertActiveSubscription } from "@/lib/payments/subscription";
import type { CategoryBudget, RecurringTransaction, SavingsGoal } from "@/types/planning";
import {
  appCategoryBudgetToDb,
  appGoalToDb,
  appRecurringToDb,
  dbCategoryBudgetToApp,
  dbGoalToApp,
  dbRecurringToApp,
} from "./planning-mapper";
import {
  appCategoryToDb,
  appTransactionToDb,
  dbCategoryToApp,
  dbTransactionToApp,
} from "./sync-mapper";
import type { CategoryDefinition, Transaction } from "@/types";
import type { TelegramWebAppUser } from "@/lib/telegram/init-data";
import { generateInviteCode } from "./invite-code";
import type { HouseholdPublic, SyncPayload } from "@/lib/household/types";

export type { HouseholdPublic, SyncPayload };

async function fetchPlanningForHousehold(householdId: string) {
  try {
    const [savingsGoals, categoryBudgets, recurringTransactions] = await Promise.all([
      prisma.savingsGoal.findMany({ where: { householdId } }),
      prisma.categoryBudget.findMany({ where: { householdId } }),
      prisma.recurringTransaction.findMany({ where: { householdId } }),
    ]);
    return {
      savingsGoals: savingsGoals.map(dbGoalToApp),
      categoryBudgets: categoryBudgets.map(dbCategoryBudgetToApp),
      recurringTransactions: recurringTransactions.map(dbRecurringToApp),
    };
  } catch (err) {
    console.warn("[household] planning tables unavailable — run prisma/planning-tables.sql", err);
    return {
      savingsGoals: [],
      categoryBudgets: [],
      recurringTransactions: [],
    };
  }
}

async function uniqueInviteCode(): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const code = generateInviteCode(6);
    const exists = await prisma.household.findUnique({ where: { inviteCode: code } });
    if (!exists) return code;
  }
  throw new Error("invite_code_collision");
}

export async function upsertTelegramUser(user: TelegramWebAppUser) {
  return prisma.user.upsert({
    where: { telegramId: BigInt(user.id) },
    create: {
      telegramId: BigInt(user.id),
      firstName: user.first_name ?? null,
      username: user.username ?? null,
    },
    update: {
      firstName: user.first_name ?? null,
      username: user.username ?? null,
    },
  });
}

export async function getUserMembership(userId: string) {
  return prisma.householdMember.findFirst({
    where: { userId },
    include: {
      household: {
        include: { members: true },
      },
    },
  });
}

/** Same Telegram account on phone + browser — one membership, many devices */
export async function getHouseholdSessionForUser(
  userId: string,
): Promise<{ household: HouseholdPublic; sync: SyncPayload } | null> {
  const membership = await getUserMembership(userId);
  if (!membership) return null;
  const sync = await buildSyncPayload(membership.householdId);
  return {
    household: toPublicHousehold(
      membership.household,
      membership.household.members.length,
    ),
    sync,
  };
}

/** User leaves cloud household — stops auto-sync for this Telegram account until join/create again */
export async function leaveHousehold(userId: string): Promise<void> {
  await prisma.householdMember.deleteMany({ where: { userId } });
}

async function seedCategories(householdId: string) {
  const defaults = getDefaultCategories();
  await prisma.category.createMany({
    data: defaults.map((c) => appCategoryToDb(householdId, c)),
    skipDuplicates: true,
  });
}

/** Новые системные категории и миграция food → groceries в облаке */
async function refreshHouseholdCategories(householdId: string) {
  const defaults = getDefaultCategories();
  for (const cat of defaults) {
    await prisma.category.upsert({
      where: { householdId_id: { householdId, id: cat.id } },
      create: appCategoryToDb(householdId, cat),
      update: {
        labelRu: cat.labels.ru,
        labelEn: cat.labels.en,
        keywords: cat.keywords,
        isSystem: cat.isSystem,
      },
    });
  }
  await prisma.transaction.updateMany({
    where: { householdId, categoryId: { in: ["food", "еда"] } },
    data: { categoryId: "groceries" },
  });
  await prisma.category.deleteMany({
    where: { householdId, id: { in: ["food", "еда"] } },
  });
  await prisma.category.deleteMany({
    where: { householdId, labelRu: "Еда", isSystem: true },
  });
}

export async function createHousehold(
  userId: string,
  opts: { name?: string; mode?: "solo" | "shared"; partnerLabel?: string | null },
): Promise<{ household: HouseholdPublic; sync: SyncPayload; isNew: boolean }> {
  await assertActiveSubscription(userId);

  const existingSession = await getHouseholdSessionForUser(userId);
  if (existingSession) return { ...existingSession, isNew: false };

  const inviteCode = await uniqueInviteCode();
  const mode: HouseholdMode = opts.mode === "shared" ? "SHARED" : "SOLO";
  const partnerLabel = opts.partnerLabel?.trim() || null;

  const household = await prisma.household.create({
    data: {
      name: opts.name?.trim() || "Семейный бюджет",
      inviteCode,
      mode,
      partnerLabel,
      members: {
        create: { userId, role: "OWNER" },
      },
    },
    include: { members: true },
  });

  await seedCategories(household.id);
  const sync = await buildSyncPayload(household.id);
  return {
    household: toPublicHousehold(household, household.members.length),
    sync,
    isNew: true,
  };
}

export async function joinHousehold(
  userId: string,
  rawCode: string,
): Promise<{ household: HouseholdPublic; sync: SyncPayload; isNew: boolean }> {
  await assertActiveSubscription(userId);

  const inviteCode = rawCode.trim().toUpperCase().replace(/^VB-?/i, "");
  if (inviteCode.length < 4) throw new Error("invalid_code");

  const existingSession = await getHouseholdSessionForUser(userId);
  if (existingSession) return { ...existingSession, isNew: false };

  const household = await prisma.household.findUnique({
    where: { inviteCode },
    include: { members: true },
  });
  if (!household) throw new Error("household_not_found");

  await prisma.householdMember.create({
    data: { householdId: household.id, userId, role: "MEMBER" },
  });

  const memberCount = household.members.length + 1;
  if (memberCount >= 2 && household.mode === "SOLO") {
    await prisma.household.update({
      where: { id: household.id },
      data: { mode: "SHARED" },
    });
  }

  const sync = await buildSyncPayload(household.id);
  return {
    household: {
      ...toPublicHousehold(household, memberCount),
      mode: memberCount >= 2 ? "shared" : "solo",
    },
    sync,
    isNew: true,
  };
}

function toPublicHousehold(
  h: { id: string; name: string; mode: HouseholdMode; inviteCode: string; partnerLabel: string | null },
  memberCount: number,
): HouseholdPublic {
  return {
    id: h.id,
    name: h.name,
    mode: h.mode === "SHARED" ? "shared" : "solo",
    inviteCode: h.inviteCode,
    partnerLabel: h.partnerLabel,
    memberCount,
  };
}

export async function buildSyncPayload(householdId: string): Promise<SyncPayload> {
  await refreshHouseholdCategories(householdId);

  const household = await prisma.household.findUniqueOrThrow({
    where: { id: householdId },
    include: { members: true },
  });

  const [transactions, categories, planning] = await Promise.all([
    prisma.transaction.findMany({
      where: { householdId },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
    prisma.category.findMany({ where: { householdId } }),
    fetchPlanningForHousehold(householdId),
  ]);

  return {
    household: toPublicHousehold(household, household.members.length),
    transactions: transactions.map(dbTransactionToApp),
    categories: categories.map(dbCategoryToApp),
    ...planning,
  };
}

export async function assertMember(userId: string, householdId: string) {
  const member = await prisma.householdMember.findUnique({
    where: { householdId_userId: { householdId, userId } },
  });
  if (!member) throw new Error("forbidden");
  await assertActiveSubscription(userId);
  return member;
}

export async function importLocalSnapshot(
  userId: string,
  householdId: string,
  data: { transactions: Transaction[]; categories?: CategoryDefinition[] },
) {
  await assertMember(userId, householdId);

  if (data.categories?.length) {
    for (const cat of data.categories) {
      await prisma.category.upsert({
        where: { householdId_id: { householdId, id: cat.id } },
        create: appCategoryToDb(householdId, cat),
        update: {
          labelRu: cat.labels.ru,
          labelEn: cat.labels.en,
          keywords: cat.keywords,
          isSystem: cat.isSystem,
        },
      });
    }
  }

  for (const tx of data.transactions) {
    await prisma.transaction.upsert({
      where: { id: tx.id },
      create: { ...appTransactionToDb(householdId, tx, userId), createdAt: new Date() },
      update: {
        amount: tx.amount,
        type: tx.type,
        categoryId: tx.categoryId,
        currency: normalizeAppCurrency(tx.currency),
        note: tx.note,
        date: tx.date,
        owner: tx.owner ?? "me",
        goalId: tx.goalId ?? null,
        goalAmount: tx.goalAmount ?? null,
      },
    });
  }

  return buildSyncPayload(householdId);
}

export async function createCloudTransaction(
  userId: string,
  householdId: string,
  tx: Transaction,
) {
  await assertMember(userId, householdId);
  await prisma.transaction.create({
    data: { ...appTransactionToDb(householdId, tx, userId), createdAt: new Date() },
  });
  return tx;
}

export async function updateCloudTransaction(
  userId: string,
  householdId: string,
  id: string,
  patch: Partial<
    Pick<Transaction, "amount" | "categoryId" | "owner" | "type" | "goalId" | "goalAmount">
  >,
) {
  await assertMember(userId, householdId);
  const existing = await prisma.transaction.findFirst({ where: { id, householdId } });
  if (!existing) throw new Error("not_found");

  return prisma.transaction.update({
    where: { id },
    data: {
      amount: patch.amount ?? existing.amount,
      categoryId: patch.categoryId ?? existing.categoryId,
      owner: patch.owner ?? existing.owner,
      type: patch.type ?? existing.type,
      ...(patch.goalId !== undefined ? { goalId: patch.goalId } : {}),
      ...(patch.goalAmount !== undefined ? { goalAmount: patch.goalAmount } : {}),
    },
  });
}

export async function deleteCloudTransaction(userId: string, householdId: string, id: string) {
  await assertMember(userId, householdId);
  const existing = await prisma.transaction.findFirst({ where: { id, householdId } });
  if (!existing) throw new Error("not_found");
  await prisma.transaction.delete({ where: { id } });
}

export async function upsertCloudCategory(
  userId: string,
  householdId: string,
  cat: CategoryDefinition,
) {
  await assertMember(userId, householdId);
  await prisma.category.upsert({
    where: { householdId_id: { householdId, id: cat.id } },
    create: appCategoryToDb(householdId, cat),
    update: {
      type: cat.type,
      labelRu: cat.labels.ru,
      labelEn: cat.labels.en,
      keywords: cat.keywords,
      isSystem: cat.isSystem,
    },
  });
}

export async function deleteCloudCategory(userId: string, householdId: string, id: string) {
  await assertMember(userId, householdId);
  const existing = await prisma.category.findUnique({
    where: { householdId_id: { householdId, id } },
  });
  if (!existing) throw new Error("not_found");

  const fallback = getFallbackCategoryId(existing.type);
  if (existing.id === fallback) throw new Error("cannot_delete_fallback");
  await prisma.transaction.updateMany({
    where: { householdId, categoryId: id },
    data: { categoryId: fallback },
  });
  await prisma.category.delete({
    where: { householdId_id: { householdId, id } },
  });
}

export async function updatePartnerLabel(
  userId: string,
  householdId: string,
  partnerLabel: string | null,
) {
  const member = await assertMember(userId, householdId);
  if (member.role !== "OWNER") throw new Error("forbidden");
  await prisma.household.update({
    where: { id: householdId },
    data: { partnerLabel: partnerLabel?.trim() || null },
  });
}

export async function upsertCloudGoal(
  userId: string,
  householdId: string,
  goal: SavingsGoal,
) {
  await assertMember(userId, householdId);
  await prisma.savingsGoal.upsert({
    where: { householdId_id: { householdId, id: goal.id } },
    create: appGoalToDb(householdId, goal),
    update: {
      name: goal.name,
      targetAmount: goal.targetAmount,
      savedAmount: goal.savedAmount,
      deadline: goal.deadline,
      kind: goal.kind,
      emergencyMonths: goal.emergencyMonths,
    },
  });
}

export async function deleteCloudGoal(userId: string, householdId: string, id: string) {
  await assertMember(userId, householdId);
  const existing = await prisma.savingsGoal.findUnique({
    where: { householdId_id: { householdId, id } },
  });
  if (!existing) throw new Error("not_found");
  if (existing.kind === "emergency") throw new Error("cannot_delete_emergency");
  await prisma.savingsGoal.delete({ where: { householdId_id: { householdId, id } } });
}

export async function depositCloudGoal(
  userId: string,
  householdId: string,
  id: string,
  amount: number,
) {
  await assertMember(userId, householdId);
  const existing = await prisma.savingsGoal.findUnique({
    where: { householdId_id: { householdId, id } },
  });
  if (!existing) throw new Error("not_found");
  await prisma.savingsGoal.update({
    where: { householdId_id: { householdId, id } },
    data: { savedAmount: existing.savedAmount + amount },
  });
}

export async function upsertCloudCategoryBudget(
  userId: string,
  householdId: string,
  budget: CategoryBudget,
) {
  await assertMember(userId, householdId);
  const data = appCategoryBudgetToDb(householdId, budget);
  await prisma.categoryBudget.upsert({
    where: { householdId_categoryId: { householdId, categoryId: data.categoryId } },
    create: { ...data, id: `${householdId}-${data.categoryId}` },
    update: { monthlyLimit: data.monthlyLimit },
  });
}

export async function deleteCloudCategoryBudget(
  userId: string,
  householdId: string,
  categoryId: string,
) {
  await assertMember(userId, householdId);
  const existing = await prisma.categoryBudget.findUnique({
    where: { householdId_categoryId: { householdId, categoryId } },
  });
  if (!existing) throw new Error("not_found");
  await prisma.categoryBudget.delete({ where: { id: existing.id } });
}

export async function upsertCloudRecurring(
  userId: string,
  householdId: string,
  item: RecurringTransaction,
) {
  await assertMember(userId, householdId);
  await prisma.recurringTransaction.upsert({
    where: { id: item.id },
    create: appRecurringToDb(householdId, item),
    update: {
      amount: item.amount,
      type: item.type,
      categoryId: item.categoryId,
      note: item.note,
      owner: item.owner ?? "me",
      frequency: item.frequency,
      dayOfMonth: item.dayOfMonth,
      nextRunDate: item.nextRunDate,
      enabled: item.enabled,
    },
  });
}

export async function deleteCloudRecurring(userId: string, householdId: string, id: string) {
  await assertMember(userId, householdId);
  const existing = await prisma.recurringTransaction.findFirst({ where: { id, householdId } });
  if (!existing) throw new Error("not_found");
  await prisma.recurringTransaction.delete({ where: { id } });
}
