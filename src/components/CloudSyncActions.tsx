"use client";

import { CloudDownload, CloudUpload, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useHouseholdCloud } from "@/hooks/useHouseholdCloud";
import { t } from "@/lib/i18n";
import { formatLastSync } from "@/lib/format-last-sync";
import { useCloudStore } from "@/store/useCloudStore";
import { useStore } from "@/store/useStore";

type Props = {
  /** Hide section title (e.g. inside settings panel) */
  embedded?: boolean;
  onDisconnect?: () => void;
};

export function CloudSyncActions({ embedded, onDisconnect }: Props) {
  const locale = useStore((s) => s.locale);
  const txCount = useStore((s) => s.transactions.length);
  const lastSyncedAt = useCloudStore((s) => s.lastSyncedAt);
  const { toast } = useToast();
  const { loading, error, pullSync, pushToCloud, isActive } = useHouseholdCloud();
  const [lastAction, setLastAction] = useState<"pull" | "push" | null>(null);

  if (!isActive) return null;

  const handlePull = async () => {
    if (!window.confirm(t(locale, "cloudSyncPullConfirm"))) return;
    setLastAction("pull");
    const ok = await pullSync();
    if (ok) {
      toast(t(locale, "cloudSyncSuccessPull"), "success");
    } else {
      toast(t(locale, "cloudSyncFailed"), "error");
    }
    setLastAction(null);
  };

  const handlePush = async () => {
    if (txCount === 0) {
      toast(t(locale, "cloudSyncPushEmpty"), "error");
      return;
    }
    if (!window.confirm(t(locale, "cloudSyncPushConfirm"))) return;
    setLastAction("push");
    const ok = await pushToCloud();
    if (ok) {
      toast(t(locale, "cloudSyncSuccessPush"), "success");
    } else {
      toast(t(locale, "cloudSyncFailed"), "error");
    }
    setLastAction(null);
  };

  return (
    <div className={embedded ? "space-y-2" : "space-y-2 rounded-lg border bg-muted/30 p-3"}>
      {!embedded && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">{t(locale, "cloudSyncTitle")}</p>
          <p className="text-xs text-muted-foreground">
            {t(locale, "cloudSyncLast", { time: formatLastSync(lastSyncedAt, locale) })}
          </p>
        </div>
      )}

      {embedded && (
        <p className="text-xs text-muted-foreground">
          {t(locale, "cloudSyncLast", { time: formatLastSync(lastSyncedAt, locale) })}
        </p>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Button
          type="button"
          variant="secondary"
          className="h-auto min-h-11 flex-col items-start gap-0.5 px-3 py-2 text-left"
          disabled={loading}
          onClick={() => void handlePull()}
        >
          <span className="flex w-full items-center gap-2 font-medium">
            {loading && lastAction === "pull" ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
            ) : (
              <CloudDownload className="h-4 w-4 shrink-0" />
            )}
            {t(locale, "cloudSyncPull")}
          </span>
          <span className="text-xs font-normal text-muted-foreground">
            {t(locale, "cloudSyncPullHint")}
          </span>
        </Button>

        <Button
          type="button"
          variant="outline"
          className="h-auto min-h-11 flex-col items-start gap-0.5 px-3 py-2 text-left"
          disabled={loading}
          onClick={() => void handlePush()}
        >
          <span className="flex w-full items-center gap-2 font-medium">
            {loading && lastAction === "push" ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
            ) : (
              <CloudUpload className="h-4 w-4 shrink-0" />
            )}
            {t(locale, "cloudSyncPush")}
          </span>
          <span className="text-xs font-normal text-muted-foreground">
            {t(locale, "cloudSyncPushHint")}
          </span>
        </Button>
      </div>

      {error && (
        <p className="text-xs text-destructive">
          {error === "sync_failed" || error === "import_failed"
            ? t(locale, "cloudSyncFailed")
            : error}
        </p>
      )}

      {onDisconnect && (
        <Button type="button" variant="ghost" className="w-full text-xs text-muted-foreground" onClick={onDisconnect}>
          {t(locale, "cloudDisconnect")}
        </Button>
      )}
    </div>
  );
}
