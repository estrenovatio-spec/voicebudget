import type { HouseholdPublic } from "@/lib/household/types";
import type { TelegramWebAppUser } from "@/lib/telegram/init-data";

export type HouseholdMemberLogAction = "create" | "join" | "open";

function formatTelegramHandle(user: TelegramWebAppUser): string {
  if (!user.username?.trim()) return "";
  const u = user.username.trim().replace(/^@/, "");
  return `@${u}`;
}

async function postToAppsScript(webhookUrl: string, body: Record<string, unknown>): Promise<void> {
  const payload = JSON.stringify(body);
  const headers = { "Content-Type": "application/json" };

  let res = await fetch(webhookUrl, {
    method: "POST",
    headers,
    body: payload,
    redirect: "manual",
  });

  if (res.status === 301 || res.status === 302 || res.status === 303 || res.status === 307) {
    const location = res.headers.get("location");
    if (location) {
      res = await fetch(location, {
        method: "POST",
        headers,
        body: payload,
        redirect: "follow",
      });
    }
  }

  const text = await res.text().catch(() => "");
  if (!res.ok) {
    throw new Error(`Google Sheets webhook HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  try {
    const parsed = JSON.parse(text) as { ok?: boolean; error?: string };
    if (parsed.ok === false) {
      throw new Error(parsed.error ?? "Apps Script returned ok: false");
    }
  } catch (e) {
    if (e instanceof SyntaxError) {
      if (!text.includes('"ok":true') && !text.includes('"ok": true')) {
        throw new Error(`Google Sheets unexpected response: ${text.slice(0, 200)}`);
      }
    } else {
      throw e;
    }
  }
}

/** Запись в Google Таблицу: первый вход, создание или присоединение к облаку (см. docs/GOOGLE-SHEETS.md) */
export async function logHouseholdMemberToGoogleSheet(opts: {
  action: HouseholdMemberLogAction;
  tgUser: TelegramWebAppUser;
  household?: HouseholdPublic | null;
}): Promise<void> {
  const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL?.trim();
  if (!webhookUrl) {
    console.warn(
      "Google Sheets: GOOGLE_SHEETS_WEBHOOK_URL не задан — участник в таблицу не записан",
    );
    return;
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() ?? "https://voicebudget.vercel.app";
  const actionLabel =
    opts.action === "create"
      ? "Создал семью"
      : opts.action === "join"
        ? "Присоединился"
        : "Открыл приложение";
  const household = opts.household ?? null;

  await postToAppsScript(webhookUrl, {
    type: "voicebudget_member",
    createdAt: new Date().toISOString(),
    action: opts.action,
    actionLabel,
    firstName: opts.tgUser.first_name?.trim() ?? "",
    lastName: opts.tgUser.last_name?.trim() ?? "",
    telegram: formatTelegramHandle(opts.tgUser),
    telegramUserId: opts.tgUser.id,
    mode: household?.mode === "shared" ? "Вдвоём" : household ? "Веду один" : "",
    memberCount: household?.memberCount ?? "",
    inviteCode: household?.inviteCode ?? "",
    householdId: household?.id ?? "",
    siteUrl,
  });
}
