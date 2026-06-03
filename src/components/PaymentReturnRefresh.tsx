"use client";

import { useEffect, useRef } from "react";
import { fetchAndApplyDevSubscription } from "@/lib/billing/dev-subscription";
import { runHouseholdBootstrap } from "@/lib/cloud/bootstrap";

/** After YooKassa return (?payment=done) reload subscription from server. */
export function PaymentReturnRefresh() {
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") !== "done") return;
    ran.current = true;

    void (async () => {
      await runHouseholdBootstrap();
      await fetchAndApplyDevSubscription(3);
      params.delete("payment");
      const q = params.toString();
      const next = `${window.location.pathname}${q ? `?${q}` : ""}${window.location.hash}`;
      window.history.replaceState(null, "", next);
    })();
  }, []);

  return null;
}
