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

function emptyPayload(): BusinessCloudPayload {
  const unit = defaultBusinessUnit();
  return { version: 2, units: [unit], transactions: [], assets: [], debts: [], passiveReceipts: [] };
}

function normalizePayload(raw: unknown): BusinessCloudPayload {
  if (!raw || typeof raw !== "object") return emptyPayload();
  const o = raw as Record<string, unknown>;
  const units = Array.isArray(o.units) ? o.units : [];
  const transactions = Array.isArray(o.transactions) ? o.transactions : [];
  const assets = Array.isArray(o.assets) ? o.assets : [];
  const debts = Array.isArray(o.debts) ? o.debts : [];
  if (units.length === 0) {
    const unit = defaultBusinessUnit();
    return {
      version: 2,
      units: [unit],
      transactions: transactions.map((t) => ({
        ...(t as object),
        unitId: (t as { unitId?: string }).unitId ?? unit.id,
      })) as BusinessCloudPayload["transactions"],
      assets: assets.map((a) => ({
        ...(a as object),
        unitId: (a as { unitId?: string }).unitId ?? unit.id,
      })) as BusinessCloudPayload["assets"],
      debts: debts.map((d) => ({
        ...(d as object),
        unitId: (d as { unitId?: string }).unitId ?? unit.id,
      })) as BusinessCloudPayload["debts"],
      passiveReceipts: [],
      taxRatePct: typeof o.taxRatePct === "number" ? o.taxRatePct : 0,
    };
  }
  const passiveReceipts = Array.isArray(o.passiveReceipts) ? o.passiveReceipts : [];

  return {
    version: 2,
    units: units as BusinessCloudPayload["units"],
    transactions: transactions as BusinessCloudPayload["transactions"],
    assets: assets as BusinessCloudPayload["assets"],
    debts: debts as BusinessCloudPayload["debts"],
    passiveReceipts: passiveReceipts as BusinessCloudPayload["passiveReceipts"],
    taxRatePct: typeof o.taxRatePct === "number" ? o.taxRatePct : 0,
  };
}

export async function fetchUserBusinessPayload(
  userId: string,
): Promise<BusinessCloudPayload | null> {
  if (!(await userBusinessLedgerTableExists())) return null;

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
  if (!(await userBusinessLedgerTableExists())) return false;

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

  const txMap = new Map<string, (typeof local.transactions)[0]>();
  for (const t of remote.transactions) txMap.set(t.id, t);
  for (const t of local.transactions) txMap.set(t.id, t);

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

  return {
    version: 2,
    units,
    transactions: Array.from(txMap.values()).sort((a, b) => b.date.localeCompare(a.date)),
    assets: Array.from(assetMap.values()),
    debts: Array.from(debtMap.values()),
    passiveReceipts: Array.from(receiptMap.values()).sort((a, b) =>
      b.date.localeCompare(a.date),
    ),
    taxRatePct: local.taxRatePct ?? remote.taxRatePct ?? 0,
  };
}
