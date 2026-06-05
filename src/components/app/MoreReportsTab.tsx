"use client";

import { FileSpreadsheet, FileText, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AiAnalysisTab } from "@/components/AiAnalysisTab";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiListAiReports, type AiReportRecord } from "@/lib/cloud/client";
import {
  buildBudgetExcelXml,
  downloadTextFile,
  filterBusinessTransactionsByPeriod,
  filterTransactionsByPeriod,
  openTransactionsPdfPrint,
} from "@/lib/export/transactions-export";
import { formatIsoPeriod } from "@/lib/format-date";
import { t } from "@/lib/i18n";
import { useBusinessStore } from "@/store/useBusinessStore";
import { useCloudStore } from "@/store/useCloudStore";
import { useCategories, useStore, useTransactions } from "@/store/useStore";

function defaultPeriod(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

function AiReportHistory({
  locale,
  kind,
  reports,
  loading,
}: {
  locale: "ru" | "en";
  kind: "weekly" | "monthly";
  reports: AiReportRecord[];
  loading: boolean;
}) {
  const filtered = reports.filter((r) => r.kind === kind);

  if (loading) {
    return <p className="text-xs text-muted-foreground">{t(locale, "moreReportsHistoryLoading")}</p>;
  }

  if (filtered.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border px-3 py-4 text-xs text-muted-foreground">
        {t(locale, "moreReportsHistoryEmpty")}
      </p>
    );
  }

  return (
    <ul className="max-h-64 space-y-2 overflow-y-auto">
      {filtered.map((r) => (
        <li
          key={r.id}
          className="rounded-md border border-border/70 bg-muted/20 px-3 py-2.5 text-sm"
        >
          <p className="text-xs font-medium text-muted-foreground">
            {formatIsoPeriod(r.periodStart, r.periodEnd, locale)}
            {" · "}
            {new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            }).format(new Date(r.createdAt))}
            {r.fallback ? ` · ${t(locale, "moreReportsFallback")}` : ""}
          </p>
          <ul className="mt-2 space-y-1 text-xs leading-snug">
            {r.tips.map((tip, i) => (
              <li key={`${r.id}-${i}`} className="rounded bg-primary/5 px-2 py-1">
                {tip}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

export function MoreReportsTab() {
  const locale = useStore((s) => s.locale);
  const transactions = useTransactions();
  const categories = useCategories();
  const businessTransactions = useBusinessStore((s) => s.transactions);
  const businessUnits = useBusinessStore((s) => s.units);
  const businessAssets = useBusinessStore((s) => s.assets);
  const token = useCloudStore((s) => s.token);
  const [period, setPeriod] = useState(defaultPeriod);
  const [reports, setReports] = useState<AiReportRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [tableReady, setTableReady] = useState(true);
  const [historyKind, setHistoryKind] = useState<"weekly" | "monthly">("weekly");

  const periodTxs = useMemo(
    () => filterTransactionsByPeriod(transactions, period.from, period.to),
    [transactions, period.from, period.to],
  );
  const periodBusinessTxs = useMemo(
    () => filterBusinessTransactionsByPeriod(businessTransactions, period.from, period.to),
    [businessTransactions, period.from, period.to],
  );
  const exportCount = periodTxs.length + periodBusinessTxs.length + businessAssets.length;

  const loadHistory = useCallback(async () => {
    if (!token) {
      setReports([]);
      return;
    }
    setHistoryLoading(true);
    try {
      const res = await apiListAiReports(token);
      setReports(res.reports ?? []);
      setTableReady(res.tableReady !== false);
    } catch {
      setReports([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    const id = window.setInterval(() => void loadHistory(), 30_000);
    return () => window.clearInterval(id);
  }, [loadHistory]);

  const exportExcel = () => {
    const workbook = buildBudgetExcelXml({
      transactions: periodTxs,
      categories,
      businessTransactions: periodBusinessTxs,
      businessUnits,
      businessAssets,
      locale,
      periodStart: period.from,
      periodEnd: period.to,
    });
    downloadTextFile(
      `prosto-budget-${period.from}_${period.to}.xls`,
      workbook,
      "application/vnd.ms-excel;charset=utf-8",
    );
  };

  const exportPdf = () => {
    if (periodTxs.length === 0) return;
    openTransactionsPdfPrint({
      transactions: periodTxs,
      categories,
      locale,
      periodStart: period.from,
      periodEnd: period.to,
      title: t(locale, "moreReportsExportTitle"),
    });
  };

  return (
    <div className="space-y-5 py-1">
      <section className="space-y-3">
        <h3 className="text-sm font-semibold">{t(locale, "moreReportsExportSection")}</h3>
        <p className="text-xs text-muted-foreground">{t(locale, "moreReportsExportHint")}</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-muted-foreground">{t(locale, "moreReportsFrom")}</label>
            <Input
              type="date"
              value={period.from}
              onChange={(e) => setPeriod((p) => ({ ...p, from: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground">{t(locale, "moreReportsTo")}</label>
            <Input
              type="date"
              value={period.to}
              onChange={(e) => setPeriod((p) => ({ ...p, to: e.target.value }))}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {t(locale, "moreReportsCount", { count: String(exportCount) })}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="secondary"
            className="gap-1.5"
            onClick={exportExcel}
          >
            <FileSpreadsheet className="h-4 w-4" aria-hidden />
            {t(locale, "moreReportsExcel")}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="gap-1.5"
            disabled={periodTxs.length === 0}
            onClick={exportPdf}
          >
            <FileText className="h-4 w-4" aria-hidden />
            {t(locale, "moreReportsPdf")}
          </Button>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-primary" aria-hidden />
          {t(locale, "moreReportsAiSection")}
        </h3>
        {!token ? (
          <p className="text-xs text-muted-foreground">{t(locale, "moreReportsCloudRequired")}</p>
        ) : !tableReady ? (
          <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-950 dark:text-amber-100">
            {t(locale, "moreReportsDbMigrate")}
          </p>
        ) : null}

        <Tabs value={historyKind} onValueChange={(v) => setHistoryKind(v as "weekly" | "monthly")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="weekly">{t(locale, "aiTabWeekly")}</TabsTrigger>
            <TabsTrigger value="monthly">{t(locale, "aiTabMonthly")}</TabsTrigger>
          </TabsList>
          <TabsContent value="weekly">
            <AiReportHistory
              locale={locale}
              kind="weekly"
              reports={reports}
              loading={historyLoading}
            />
          </TabsContent>
          <TabsContent value="monthly">
            <AiReportHistory
              locale={locale}
              kind="monthly"
              reports={reports}
              loading={historyLoading}
            />
          </TabsContent>
        </Tabs>

        <Button type="button" size="sm" variant="ghost" onClick={() => void loadHistory()}>
          {t(locale, "moreReportsRefreshHistory")}
        </Button>

        <p className="text-xs font-medium">{t(locale, "moreReportsGenerate")}</p>
        <AiAnalysisTab active reportsOnly />
      </section>
    </div>
  );
}
