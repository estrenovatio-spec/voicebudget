#!/usr/bin/env node
/**
 * JSON backup of all Prisma tables (when pg_dump is unavailable).
 * Usage: node scripts/with-env-local.cjs node scripts/backup-db.mjs
 */
import { PrismaClient } from "@prisma/client";
import { writeFileSync, mkdirSync, copyFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const backupDir = join(root, "backups", ts);

mkdirSync(backupDir, { recursive: true });

const prisma = new PrismaClient();

async function main() {
  const data = {
    exportedAt: new Date().toISOString(),
    users: await prisma.user.findMany(),
    households: await prisma.household.findMany(),
    members: await prisma.householdMember.findMany(),
    transactions: await prisma.transaction.findMany(),
    categories: await prisma.category.findMany(),
    savingsGoals: await prisma.savingsGoal.findMany().catch(() => []),
    categoryBudgets: await prisma.categoryBudget.findMany().catch(() => []),
    recurringTransactions: await prisma.recurringTransaction.findMany().catch(() => []),
    subscriptions: await prisma.subscription.findMany().catch(() => []),
    payments: await prisma.payment.findMany().catch(() => []),
  };

  // BigInt → string for JSON
  const json = JSON.stringify(
    data,
    (_k, v) => (typeof v === "bigint" ? v.toString() : v),
    2,
  );
  writeFileSync(join(backupDir, "data.json"), json);

  for (const sql of ["setup-tables.sql", "planning-tables.sql", "subscription-tables.sql"]) {
    const src = join(root, "prisma", sql);
    if (existsSync(src)) copyFileSync(src, join(backupDir, sql));
  }

  const counts = Object.fromEntries(
    Object.entries(data)
      .filter(([k]) => k !== "exportedAt")
      .map(([k, v]) => [k, Array.isArray(v) ? v.length : 0]),
  );
  console.log(`Backup saved to backups/${ts}/`);
  console.log(JSON.stringify(counts, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
