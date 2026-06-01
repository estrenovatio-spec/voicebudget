import { isFuelExpense } from "@/lib/vehicle";
import type { Transaction } from "@/types";

export type FuelStatResult = {
  rubPer100Km: number | null;
  deltaKm: number;
  lastAmount: number;
  detail: "ok" | "need_two_fills" | "no_odometer" | "zero_distance";
};

/** ₽ / 100 км по последней паре заправок с пробегом для этой машины. */
export function fuelRubPer100Km(
  vehicleId: string,
  transactions: readonly Transaction[],
): FuelStatResult {
  const fills = transactions
    .filter(
      (tx) =>
        tx.vehicleId === vehicleId &&
        isFuelExpense(tx) &&
        tx.odometerKm != null &&
        tx.odometerKm > 0,
    )
    .sort((a, b) => {
      const byOdo = a.odometerKm! - b.odometerKm!;
      if (byOdo !== 0) return byOdo;
      return b.date.localeCompare(a.date);
    });

  if (fills.length < 2) {
    return {
      rubPer100Km: null,
      deltaKm: 0,
      lastAmount: fills[0]?.amount ?? 0,
      detail: fills.length === 0 ? "no_odometer" : "need_two_fills",
    };
  }

  const prev = fills[fills.length - 2]!;
  const last = fills[fills.length - 1]!;
  const deltaKm = last.odometerKm! - prev.odometerKm!;
  if (deltaKm <= 0) {
    return { rubPer100Km: null, deltaKm, lastAmount: last.amount, detail: "zero_distance" };
  }

  const rubPer100Km = Math.round((last.amount / deltaKm) * 100);
  return { rubPer100Km, deltaKm, lastAmount: last.amount, detail: "ok" };
}
