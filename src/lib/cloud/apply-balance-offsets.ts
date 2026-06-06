import { cashOffsetsForViewer, parseBalanceOffsets } from "@/lib/balance-offsets";
import type { BalanceOffsetsByUser } from "@/lib/balance-offsets";
import { decodeUserIdFromHouseholdToken } from "@/lib/cloud/viewer-identity";
import { getCurrentBudgetPeriod } from "@/lib/budget-period";
import { useCloudStore } from "@/store/useCloudStore";
import { useStore } from "@/store/useStore";

/** Применить облачные корректировки баланса к локальному store (после pull / rehydrate). */
export function applyBalanceOffsetsFromCloud(
  offsets?: BalanceOffsetsByUser | null,
  memberUserIds?: readonly string[],
): void {
  const cloud = useCloudStore.getState();
  const token = cloud.token;
  if (!token || !cloud.household) return;

  const parsed = parseBalanceOffsets(offsets ?? cloud.balanceOffsets);
  const members =
    memberUserIds && memberUserIds.length > 0
      ? memberUserIds
      : cloud.householdMemberUserIds;

  const viewerUserId =
    decodeUserIdFromHouseholdToken(token) ?? cloud.cloudUserId ?? null;
  const period = getCurrentBudgetPeriod(useStore.getState().budgetMonthStartDay);
  const cash = cashOffsetsForViewer(parsed, viewerUserId, members, period.from);

  useStore.setState({
    cashOffsetMe: cash.cashOffsetMe,
    cashOffsetPartner: cash.cashOffsetPartner,
  });
}
