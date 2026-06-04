"use client";

import { Settings } from "lucide-react";
import { PreviewHeaderNav } from "@/components/app/PreviewHeaderNav";
import { Button } from "@/components/ui/button";
import { CloudHeaderStatus } from "@/components/CloudHeaderStatus";
import { requestOpenSettings } from "@/lib/billing/trial-banner";
import type { AppTabId } from "@/lib/app-bottom-nav";
import { t } from "@/lib/i18n";
import { useStore } from "@/store/useStore";

/** Верхняя полоска для разделов «Бизнес» / «Ещё» в preview (навигация + настройки). */
export function PreviewViewChrome({
  active,
  onChange,
}: {
  active: AppTabId;
  onChange: (tab: AppTabId) => void;
}) {
  const locale = useStore((s) => s.locale);

  return (
    <div className="flex items-start justify-between gap-2 pb-2 pt-1">
      <PreviewHeaderNav active={active} onChange={onChange} />
      <div className="flex shrink-0 flex-col items-end gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8 shrink-0"
          aria-label={t(locale, "settings")}
          onClick={() => requestOpenSettings()}
        >
          <Settings className="h-4 w-4" aria-hidden />
        </Button>
        <CloudHeaderStatus />
      </div>
    </div>
  );
}
