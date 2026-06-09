import { randomUUID } from "node:crypto";
import type { BusinessCloudPayload } from "@/lib/business/types";
import { defaultBusinessUnit } from "@/lib/business/types";
import { prisma } from "@/lib/db";
import { isMissingDbObject } from "@/lib/household/db-capabilities";

let ledgerTableExistsCache: { value: boolean; checkedAt: number } | null = null;
const LEDGER_TABLE_CACHE_MS = 60_000;

async function userBusinessLedgerTableExists(): Promise<boolean> {
  if (
    ledgerTableExistsCache &&
    Date.now() - ledgerTableExistsCache.checkedAt < LEDGER_TABLE_CACHE_MS
  ) {
    return ledgerTableExistsCache.value;
  }

  try {
    const rows = await prisma.$queryRaw<{ exists: boolean }[]>`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'UserBusinessLedger'
      ) AS "exists"
    `;
    const value = Boolean(rows[0]?.exists);
    ledgerTableExistsCache = { value, checkedAt: Date.now() };
    return value;
  } catch {
    ledgerTableExistsCache = { value: false, checkedAt: Date.now() };
    return false;
  }
}

export async function ensureBusinessCloudTables(): Promise<boolean> {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "UserBusinessLedger" (
        "userId" TEXT PRIMARY KEY,
        "payload" JSONB NOT NULL DEFAULT '{}'::jsonb,
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "UserBusinessLedger_userId_fkey"
          FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION "set_UserBusinessLedger_updatedAt"()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW."updatedAt" = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await prisma.$executeRawUnsafe(`
      DROP TRIGGER IF EXISTS "UserBusinessLedger_updatedAt_trigger" ON "UserBusinessLedger"
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER "UserBusinessLedger_updatedAt_trigger"
      BEFORE UPDATE ON "UserBusinessLedger"
      FOR EACH ROW
      EXECUTE FUNCTION "set_UserBusinessLedger_updatedAt"()
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "UserBusinessBackup" (
        "id" TEXT PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "payload" JSONB NOT NULL,
        "reason" TEXT NOT NULL DEFAULT 'manual',
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "UserBusinessBackup_userId_fkey"
          FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "UserBusinessBackup_userId_createdAt_idx"
      ON "UserBusinessBackup" ("userId", "createdAt" DESC)
    `);
    ledgerTableExistsCache = { value: true, checkedAt: Date.now() };
    return true;
  } catch (e) {
    console.error("[business/cloud tables]", e);
    ledgerTableExistsCache = { value: false, checkedAt: Date.now() };
    return false;
  }
}

function emptyPayload(): BusinessCloudPayload {
  const unit = defaultBusinessUnit();
  return {
    version: 2,
    units: [unit],
    transactions: [],
    deletedTransactionIds: [],
    assets: [],
    debts: [],
    deletedUnitsArchive: [],
    passiveReceipts: [],
  };
}

function normalizePayload(raw: unknown): BusinessCloudPayload {
  if (!raw || typeof raw !== "object") return emptyPayload();
  const o = raw as Record<string, unknown>;
  const units = Array.isArray(o.units) ? o.units : [];
  const transactions = Array.isArray(o.transactions) ? o.transactions : [];
  const deletedTransactionIds = Array.isArray(o.deletedTransactionIds)
    ? o.deletedTransactionIds.filter((id): id is string => typeof id === "string")
    : [];
  const deletedTransactionIdSet = new Set(deletedTransactionIds);
  const assets = Array.isArray(o.assets) ? o.assets : [];
  const debts = Array.isArray(o.debts) ? o.debts : [];
  const deletedUnitsArchive = Array.isArray(o.deletedUnitsArchive) ? o.deletedUnitsArchive : [];
  if (units.length === 0) {
    const unit = defaultBusinessUnit();
    return {
      version: 2,
      units: [unit],
      transactions: transactions
        .map((t) => ({
          ...(t as object),
          unitId: (t as { unitId?: string }).unitId ?? unit.id,
        }))
        .filter((t) => !deletedTransactionIdSet.has((t as { id?: string }).id ?? "")) as BusinessCloudPayload["transactions"],
      deletedTransactionIds,
      assets: assets.map((a) => ({
        ...(a as object),
        unitId: (a as { unitId?: string }).unitId ?? unit.id,
      })) as BusinessCloudPayload["assets"],
      debts: debts.map((d) => ({
        ...(d as object),
        unitId: (d as { unitId?: string }).unitId ?? unit.id,
      })) as BusinessCloudPayload["debts"],
      deletedUnitsArchive:
        deletedUnitsArchive as BusinessCloudPayload["deletedUnitsArchive"],
      passiveReceipts: [],
      taxRatePct: typeof o.taxRatePct === "number" ? o.taxRatePct : 0,
    };
  }
  const passiveReceipts = Array.isArray(o.passiveReceipts) ? o.passiveReceipts : [];

  return {
    version: 2,
    units: units as BusinessCloudPayload["units"],
    transactions: (transactions as BusinessCloudPayload["transactions"]).filter(
      (t) => !deletedTransactionIdSet.has(t.id),
    ),
    deletedTransactionIds,
    assets: assets as BusinessCloudPayload["assets"],
    debts: debts as BusinessCloudPayload["debts"],
    deletedUnitsArchive:
      deletedUnitsArchive as BusinessCloudPayload["deletedUnitsArchive"],
    passiveReceipts: passiveReceipts as BusinessCloudPayload["passiveReceipts"],
    taxRatePct: typeof o.taxRatePct === "number" ? o.taxRatePct : 0,
  };
}

export function hasMeaningfulBusinessPayload(payload: BusinessCloudPayload | null | undefined): boolean {
  if (!payload) return false;
  const units = payload.units ?? [];
  const nonDefaultUnits = units.filter((unit) => {
    const name = unit?.name?.trim().toLowerCase();
    return name && name !== "мой бизнес";
  });
  return (
    nonDefaultUnits.length > 0 ||
    (payload.transactions?.length ?? 0) > 0 ||
    (payload.assets?.length ?? 0) > 0 ||
    (payload.debts?.length ?? 0) > 0 ||
    (payload.passiveReceipts?.length ?? 0) > 0 ||
    (payload.deletedUnitsArchive?.length ?? 0) > 0
  );
}

export async function backupUserBusinessPayload(
  userId: string,
  payload: BusinessCloudPayload,
  reason = "before_update",
): Promise<boolean> {
  if (!(await ensureBusinessCloudTables())) return false;
  const data = normalizePayload(payload);
  if (!hasMeaningfulBusinessPayload(data)) return false;
  try {
    const id = randomUUID();
    await prisma.$executeRaw`
      INSERT INTO "UserBusinessBackup" ("id", "userId", "payload", "reason")
      VALUES (${id}, ${userId}, CAST(${JSON.stringify(data)} AS jsonb), ${reason})
    `;
    await prisma.$executeRaw`
      DELETE FROM "UserBusinessBackup"
      WHERE "userId" = ${userId}
        AND "id" NOT IN (
          SELECT "id" FROM "UserBusinessBackup"
          WHERE "userId" = ${userId}
          ORDER BY "createdAt" DESC
          LIMIT 90
        )
    `;
    return true;
  } catch (e) {
    console.error("[business/backup]", e);
    return false;
  }
}

export type UserBusinessBackupSummary = {
  id: string;
  createdAt: string;
  reason: string;
  units: number;
  transactions: number;
  assets: number;
  debts: number;
  unitNames: string[];
  assetNames: string[];
};

function backupSummary(row: { id: string; createdAt: Date; reason: string; payload: unknown }): UserBusinessBackupSummary {
  const payload = normalizePayload(row.payload);
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    reason: row.reason,
    units: payload.units.length,
    transactions: payload.transactions.length,
    assets: payload.assets.length,
    debts: payload.debts?.length ?? 0,
    unitNames: payload.units.map((unit) => unit.name).filter(Boolean).slice(0, 6),
    assetNames: payload.assets.map((asset) => asset.name).filter(Boolean).slice(0, 6),
  };
}

export async function listUserBusinessBackups(
  userId: string,
  limit = 20,
): Promise<UserBusinessBackupSummary[]> {
  if (!(await ensureBusinessCloudTables())) return [];
  const rows = await prisma.$queryRaw<
    { id: string; createdAt: Date; reason: string; payload: unknown }[]
  >`
    SELECT "id", "createdAt", "reason", "payload"
    FROM "UserBusinessBackup"
    WHERE "userId" = ${userId}
    ORDER BY "createdAt" DESC
    LIMIT ${Math.max(1, Math.min(50, limit))}
  `;
  return rows.map(backupSummary);
}

export async function restoreUserBusinessBackup(
  userId: string,
  backupId: string,
): Promise<BusinessCloudPayload | null> {
  if (!(await ensureBusinessCloudTables())) return null;
  const rows = await prisma.$queryRaw<{ payload: unknown }[]>`
    SELECT "payload"
    FROM "UserBusinessBackup"
    WHERE "userId" = ${userId} AND "id" = ${backupId}
    LIMIT 1
  `;
  const payload = rows[0]?.payload;
  if (!payload) return null;
  const current = await fetchUserBusinessPayload(userId);
  if (current) await backupUserBusinessPayload(userId, current, "before_restore");
  const restored = normalizePayload(payload);
  await saveUserBusinessPayload(userId, restored);
  return restored;
}

export async function fetchUserBusinessPayload(
  userId: string,
): Promise<BusinessCloudPayload | null> {
  if (!(await ensureBusinessCloudTables())) return null;

  try {
    const row = await prisma.userBusinessLedger.findUnique({ where: { userId } });
    if (!row) return null;
    return normalizePayload(row.payload);
  } catch (err) {
    if (!isMissingDbObject(err)) throw err;
    try {
      const rows = await prisma.$queryRaw<{ payload: unknown }[]>`
        SELECT payload FROM "UserBusinessLedger" WHERE "userId" = ${userId} LIMIT 1
      `;
      if (!rows[0]) return null;
      return normalizePayload(rows[0].payload);
    } catch {
      return null;
    }
  }
}

export async function saveUserBusinessPayload(
  userId: string,
  payload: BusinessCloudPayload,
): Promise<boolean> {
  if (!(await ensureBusinessCloudTables())) return false;

  const data = normalizePayload(payload);
  try {
    await prisma.userBusinessLedger.upsert({
      where: { userId },
      create: { userId, payload: data },
      update: { payload: data },
    });
    return true;
  } catch (err) {
    if (!isMissingDbObject(err)) throw err;
    ledgerTableExistsCache = { value: false, checkedAt: Date.now() };
    return false;
  }
}

export function mergeBusinessPayload(
  local: BusinessCloudPayload,
  remote: BusinessCloudPayload,
): BusinessCloudPayload {
  const unitMap = new Map<string, (typeof local.units)[0]>();
  for (const u of remote.units) unitMap.set(u.id, u);
  for (const u of local.units) unitMap.set(u.id, u);

  const deletedTransactionIds = new Set<string>([
    ...(remote.deletedTransactionIds ?? []),
    ...(local.deletedTransactionIds ?? []),
  ]);

  const txMap = new Map<string, (typeof local.transactions)[0]>();
  for (const t of remote.transactions) txMap.set(t.id, t);
  for (const t of local.transactions) txMap.set(t.id, t);
  for (const id of deletedTransactionIds) txMap.delete(id);

  const assetMap = new Map<string, (typeof local.assets)[0]>();
  for (const a of [...remote.assets, ...local.assets]) {
    if (a && typeof a.id === "string") assetMap.set(a.id, a);
  }

  const units = Array.from(unitMap.values());
  if (units.length === 0) units.push(defaultBusinessUnit());

  const receiptMap = new Map<string, NonNullable<BusinessCloudPayload["passiveReceipts"]>[number]>();
  for (const r of [...(remote.passiveReceipts ?? []), ...(local.passiveReceipts ?? [])]) {
    if (r && typeof r.id === "string") receiptMap.set(r.id, r);
  }
  const debtMap = new Map<string, NonNullable<BusinessCloudPayload["debts"]>[number]>();
  for (const d of [...(remote.debts ?? []), ...(local.debts ?? [])]) {
    if (d && typeof d.id === "string") debtMap.set(d.id, d);
  }
  const archiveMap = new Map<
    string,
    NonNullable<BusinessCloudPayload["deletedUnitsArchive"]>[number]
  >();
  for (const item of [
    ...(remote.deletedUnitsArchive ?? []),
    ...(local.deletedUnitsArchive ?? []),
  ]) {
    if (item && typeof item.id === "string") archiveMap.set(item.id, item);
  }

  return {
    version: 2,
    units,
    transactions: Array.from(txMap.values()).sort((a, b) => b.date.localeCompare(a.date)),
    deletedTransactionIds: Array.from(deletedTransactionIds).slice(-500),
    assets: Array.from(assetMap.values()),
    debts: Array.from(debtMap.values()),
    deletedUnitsArchive: Array.from(archiveMap.values())
      .sort((a, b) => b.deletedAt.localeCompare(a.deletedAt))
      .slice(0, 30),
    passiveReceipts: Array.from(receiptMap.values()).sort((a, b) =>
      b.date.localeCompare(a.date),
    ),
    taxRatePct: local.taxRatePct ?? remote.taxRatePct ?? 0,
  };
}
