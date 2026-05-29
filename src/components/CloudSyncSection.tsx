"use client";

import { Button } from "@/components/ui/button";
import { CloudSyncActions } from "@/components/CloudSyncActions";
import { useToast } from "@/components/ui/toast";
import { isCloudPaused } from "@/lib/cloud/cloud-pause";
import { useHouseholdCloud } from "@/hooks/useHouseholdCloud";
import { t } from "@/lib/i18n";
import { useStore } from "@/store/useStore";

/** Sync block on main screen — includes paused / disconnected state */
export function CloudSyncSection() {
  const locale = useStore((s) => s.locale);
  const { toast } = useToast();
  const paused = isCloudPaused();
  const { isActive, resumeCloud, disconnectCloud, loading } = useHouseholdCloud();

  if (paused && !isActive) {
    return (
      <div className="space-y-2 rounded-lg border border-dashed p-3">
        <p className="text-sm font-medium">{t(locale, "cloudPausedTitle")}</p>
        <p className="text-xs text-muted-foreground">{t(locale, "cloudPausedHint")}</p>
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          disabled={loading}
          onClick={() => void resumeCloud()}
        >
          {t(locale, "cloudResume")}
        </Button>
      </div>
    );
  }

  const handleDisconnect = async () => {
    if (!window.confirm(t(locale, "cloudDisconnectConfirm"))) return;
    const ok = await disconnectCloud();
    if (ok) toast(t(locale, "cloudDisconnected"), "success");
  };

  return <CloudSyncActions onDisconnect={() => void handleDisconnect()} />;
}
