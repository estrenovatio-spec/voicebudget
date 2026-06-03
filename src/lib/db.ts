import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

/** Supabase pooler (:6543) needs pgbouncer=true for Prisma on serverless. */
export function resolveDatabaseUrl(): string | undefined {
  const url = process.env.DATABASE_URL?.trim();
  if (!url || url === '""' || url === "''") return undefined;
  if (
    (url.includes("pooler.supabase.com") || url.includes(":6543")) &&
    !url.includes("pgbouncer=true")
  ) {
    return url.includes("?") ? `${url}&pgbouncer=true` : `${url}?pgbouncer=true`;
  }
  return url;
}

const databaseUrl = resolveDatabaseUrl();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    ...(databaseUrl ? { datasources: { db: { url: databaseUrl } } } : {}),
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export function isDatabaseConfigured(): boolean {
  const url = resolveDatabaseUrl();
  if (!url) return false;
  return /^postgres(ql)?:\/\//i.test(url);
}
