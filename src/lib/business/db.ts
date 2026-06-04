import type { BusinessCloudPayload } from "@/lib/business/types";
import { defaultBusinessUnit } from "@/lib/business/types";
import { prisma } from "@/lib/db";
import { isMissingDbObject } from "@/lib/household/db-capabilities";

function emptyPayload(): BusinessCloudPayload {
  const unit = defaultBusinessUnit();
  return { version: 2, units: [unit], transactions: [], assets: [] };
}

function normalizePayload(raw: unknown): BusinessCloudPayload {
  if (!raw || typeof raw !== "object") return emptyPayload();
  const o = raw as Record<string, unknown>;
  const units = Array.isArray(o.units) ? o.units : [];
  const transactions = Array.isArray(o.transactions) ? o.transactions : [];
  const assets = Array.isArray(o.assets) ? o.assets : [];
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
      taxRatePct: typeof o.taxRatePct === "number" ? o.taxRatePct : 0,
    };
  }
  return {
    version: 2,
    units: units as BusinessCloudPayload["units"],
    transactions: transactions as BusinessCloudPayload["transactions"],
    assets: assets as BusinessCloudPayload["assets"],
    taxRatePct: typeof o.taxRatePct === "number" ? o.taxRatePct : 0,
  };
}

export async function fetchUserBusinessPayload(
  userId: string,
): Promise<BusinessCloudPayload | null> {
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
): Promise<void> {
  const data = normalizePayload(payload);
  try {
    await prisma.userBusinessLedger.upsert({
      where: { userId },
      create: { userId, payload: data },
      update: { payload: data },
    });
  } catch (err) {
    if (!isMissingDbObject(err)) throw err;
    await prisma.$executeRaw`
      INSERT INTO "UserBusinessLedger" ("userId", payload, "updatedAt")
      VALUES (${userId}, ${JSON.stringify(data)}::jsonb, NOW())
      ON CONFLICT ("userId") DO UPDATE
      SET payload = EXCLUDED.payload, "updatedAt" = NOW()
    `;
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
  for (const a of remote.assets) assetMap.set(a.id, a);
  for (const a of local.assets) assetMap.set(a.id, a);

  const units = Array.from(unitMap.values());
  if (units.length === 0) units.push(defaultBusinessUnit());

  return {
    version: 2,
    units,
    transactions: Array.from(txMap.values()).sort((a, b) => b.date.localeCompare(a.date)),
    assets: Array.from(assetMap.values()),
    taxRatePct: local.taxRatePct ?? remote.taxRatePct ?? 0,
  };
}
