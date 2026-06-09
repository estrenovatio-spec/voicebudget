"use client";

import { CloudDownload, CloudUpload, Loader2, RotateCcw } from "lucide-react";
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

const cloudPullButtonClass =
  "border-sky-600/40 bg-sky-600 text-white shadow-sm hover:bg-sky-700 active:bg-sky-800 dark:border-sky-500/50 dark:bg-sky-600 dark:hover:bg-sky-500";

const cloudPushButtonClass =
  "border-emerald-600/40 bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 active:bg-emerald-800 dark:border-emerald-500/50 dark:bg-emerald-600 dark:hover:bg-emerald-500";

const cloudActionHintClass = "text-white/80";

export function CloudSyncActions({ embedded, onDisconnect }: Props) {
  const locale = useStore((s) => s.locale);
  const txCount = useStore((s) => s.transactions.length);
  const lastSyncedAt = useCloudStore((s) => s.lastSyncedAt);
  const { toast } = useToast();
  const { loading, error, pullSync, pushToCloud, replaceCloudWithThisDevice, isActive } =
    useHouseholdCloud();
  const [lastAction, setLastAction] = useState<"pull" | "push" | "replace" | null>(null);

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

  const handleReplace = async () => {
    if (!window.confirm(t(locale, "cloudSyncReplaceConfirm"))) return;
    setLastAction("replace");
    const ok = await replaceCloudWithThisDevice();
    if (ok) {
      toast(t(locale, "cloudSyncSuccessReplace"), "success");
    } else {
      toast(t(locale, "cloudSyncFailed"), "error");
    }
    setLastAction(null);
  };

  return (
    <div
      className={
        embedded
          ? "min-w-0 space-y-2 overflow-hidden"
          : "space-y-2 rounded-lg border bg-muted/30 p-3"
      }
    >
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

      <div className={embedded ? "grid grid-cols-1 gap-2" : "grid grid-cols-1 gap-2 sm:grid-cols-2"}>
        <Button
          type="button"
          variant="default"
          className={`h-auto min-h-11 w-full min-w-0 whitespace-normal flex-col items-start gap-0.5 px-3 py-2 text-left ${cloudPullButtonClass}`}
          disabled={loading}
          onClick={() => void handlePull()}
        >
          <span className="flex w-full min-w-0 items-center gap-2 font-medium leading-snug">
            {loading && lastAction === "pull" ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
            ) : (
              <CloudDownload className="h-4 w-4 shrink-0" />
            )}
            <span className="min-w-0 break-words">{t(locale, "cloudSyncPull")}</span>
          </span>
          <span
            className={`w-full text-xs font-normal leading-snug break-words ${cloudActionHintClass}`}
          >
            {t(locale, "cloudSyncPullHint")}
          </span>
        </Button>

        <Button
          type="button"
          variant="default"
          className={`h-auto min-h-11 w-full min-w-0 whitespace-normal flex-col items-start gap-0.5 px-3 py-2 text-left ${cloudPushButtonClass}`}
          disabled={loading}
          onClick={() => void handlePush()}
        >
          <span className="flex w-full min-w-0 items-center gap-2 font-medium leading-snug">
            {loading && lastAction === "push" ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
            ) : (
              <CloudUpload className="h-4 w-4 shrink-0" />
            )}
            <span className="min-w-0 break-words">{t(locale, "cloudSyncPush")}</span>
          </span>
          <span
            className={`w-full text-xs font-normal leading-snug break-words ${cloudActionHintClass}`}
          >
            {t(locale, "cloudSyncPushHint")}
          </span>
        </Button>
      </div>

      <Button
        type="button"
        variant="outline"
        className="h-auto min-h-11 w-full min-w-0 whitespace-normal flex-col items-start gap-0.5 px-3 py-2 text-left"
        disabled={loading}
        onClick={() => void handleReplace()}
      >
        <span className="flex w-full min-w-0 items-center gap-2 font-medium leading-snug">
          {loading && lastAction === "replace" ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
          ) : (
            <RotateCcw className="h-4 w-4 shrink-0" />
          )}
          <span className="min-w-0 break-words">{t(locale, "cloudSyncReplace")}</span>
        </span>
        <span className="w-full break-words text-xs font-normal leading-snug text-muted-foreground">
          {t(locale, "cloudSyncReplaceHint", { count: String(txCount) })}
        </span>
      </Button>

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
