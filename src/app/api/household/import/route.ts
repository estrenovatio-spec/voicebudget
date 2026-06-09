import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbUnavailable, forbidden, mapCloudGuardError, unauthorized } from "@/lib/api/household-response";
import { requireSession } from "@/lib/api/household-auth";
import { isDatabaseConfigured } from "@/lib/db";
import { importLocalSnapshot, assertMember } from "@/lib/household/service";

const txSchema = z.object({
  id: z.string(),
  amount: z.number(),
  type: z.enum(["income", "expense"]),
  categoryId: z.string(),
  currency: z.enum(["RUB", "USD", "EUR"]),
  note: z.string(),
  date: z.string(),
  owner: z.enum(["me", "partner"]).optional(),
  goalId: z.string().nullable().optional(),
  goalAmount: z.number().nullable().optional(),
  confirmed: z.boolean().optional(),
  recurringId: z.string().nullable().optional(),
  createdBy: z.string().nullable().optional(),
  odometerKm: z.number().nullable().optional(),
  vehicleId: z.string().nullable().optional(),
  transferPairId: z.string().nullable().optional(),
  businessTxId: z.string().nullable().optional(),
});

const bodySchema = z.object({
  transactions: z.array(txSchema),
  replaceTransactions: z.boolean().optional(),
  categories: z
    .array(
      z.object({
        id: z.string(),
        type: z.enum(["income", "expense"]),
        labels: z.object({ ru: z.string(), en: z.string() }),
        keywords: z.array(z.string()),
        isSystem: z.boolean(),
      }),
    )
    .optional(),
});

export async function POST(req: NextRequest) {
  if (!isDatabaseConfigured()) return dbUnavailable();

  const session = requireSession(req);
  if (!session) return unauthorized();

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  try {
    await assertMember(session.userId, session.householdId);
    const sync = await importLocalSnapshot(session.userId, session.householdId, {
      transactions: body.transactions.map((t) => ({
        ...t,
        owner: t.owner ?? "me",
      })),
      categories: body.categories?.map((c) => ({
        id: c.id,
        type: c.type,
        labels: c.labels,
        keywords: c.keywords,
        isSystem: c.isSystem,
      })),
      replaceTransactions: body.replaceTransactions === true,
    });
    return NextResponse.json({ ok: true, sync });
  } catch (e) {
    const guard = mapCloudGuardError(e);
    if (guard) return guard;
    throw e;
  }
}
