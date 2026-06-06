/** Корректировки «реально в кармане» по userId участника семьи (в облаке). */
export type BalanceOffsetEntry = {
  offset: number;
  periodStart?: string | null;
};
export type BalanceOffsetsByUser = Record<string, number | BalanceOffsetEntry>;

function coerceOffset(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value.replace(/\s/g, "").replace(",", "."));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export function parseBalanceOffsets(raw: unknown): BalanceOffsetsByUser {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: BalanceOffsetsByUser = {};
  for (const [key, value] of Object.entries(raw)) {
    const n = coerceOffset(value);
    if (n !== null) {
      out[key] = n;
      continue;
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const entry = value as Record<string, unknown>;
      const offset = coerceOffset(entry.offset);
      if (offset !== null) {
        out[key] = {
          offset,
          periodStart:
            typeof entry.periodStart === "string" ? entry.periodStart : null,
        };
      }
    }
  }
  return out;
}

function offsetForPeriod(
  value: BalanceOffsetsByUser[string] | undefined,
  periodStart: string,
): number {
  if (typeof value === "number") return 0;
  if (!value || typeof value !== "object") return 0;
  return value.periodStart === periodStart ? value.offset : 0;
}

/** Партнёр: из memberUserIds или единственный другой ключ в offsets (если ids на устройстве устарели). */
export function resolvePartnerUserId(
  viewerUserId: string | null,
  memberUserIds: readonly string[],
  offsets?: BalanceOffsetsByUser,
): string | null {
  if (!viewerUserId) return null;
  const fromMembers = memberUserIds.find((id) => id !== viewerUserId);
  if (fromMembers) return fromMembers;
  if (!offsets) return null;
  const keys = Object.keys(offsets).filter((id) => id !== viewerUserId);
  return keys.length > 0 ? keys[0]! : null;
}

/** Локальные cashOffsetMe / cashOffsetPartner с точки зрения текущего зрителя. */
export function cashOffsetsForViewer(
  offsets: BalanceOffsetsByUser | undefined,
  viewerUserId: string | null,
  memberUserIds: readonly string[],
  periodStart: string,
): { cashOffsetMe: number; cashOffsetPartner: number } {
  if (!viewerUserId || !offsets) {
    return { cashOffsetMe: 0, cashOffsetPartner: 0 };
  }
  const partnerId = resolvePartnerUserId(viewerUserId, memberUserIds, offsets);
  return {
    cashOffsetMe: offsetForPeriod(offsets[viewerUserId], periodStart),
    cashOffsetPartner: partnerId ? offsetForPeriod(offsets[partnerId], periodStart) : 0,
  };
}
