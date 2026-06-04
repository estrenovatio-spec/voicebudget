"use client";

import { Briefcase, Home, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AppTabId } from "@/lib/app-bottom-nav";
import { t } from "@/lib/i18n";
import { useStore } from "@/store/useStore";

export function PreviewHeaderNav({
  active,
  onChange,
}: {
  active: AppTabId;
  onChange: (tab: AppTabId) => void;
}) {
  const locale = useStore((s) => s.locale);

  return (
    <div className="flex items-center gap-1">
      {active !== "family" ? (
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8 shrink-0"
          aria-label={t(locale, "appTabFamily")}
          onClick={() => onChange("family")}
        >
          <Home className="h-4 w-4" aria-hidden />
        </Button>
      ) : null}
      <Button
        type="button"
        variant={active === "business" ? "default" : "outline"}
        size="sm"
        className="min-w-[2.5rem] gap-1 px-2 font-semibold"
        aria-label={t(locale, "businessModeAria")}
        aria-current={active === "business" ? "page" : undefined}
        onClick={() => onChange("business")}
      >
        <Briefcase className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
        {t(locale, "businessModeButton")}
      </Button>
      <Button
        type="button"
        variant={active === "more" ? "default" : "outline"}
        size="sm"
        className="gap-1 px-2 font-semibold"
        aria-label={t(locale, "appTabMore")}
        aria-current={active === "more" ? "page" : undefined}
        onClick={() => onChange("more")}
      >
        <MoreHorizontal className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
        {t(locale, "appTabMore")}
      </Button>
    </div>
  );
}
