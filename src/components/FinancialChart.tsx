"use client";

import { BarChart3, ChevronDown, ChevronUp, TrendingDown, TrendingUp } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Button } from "@/components/ui/button";
import {
  HomeSectionCardHeader,
  HomeSectionCollapsedBar,
  homeSectionContentClassName,
  sectionToggleButtonClassName,
} from "@/components/HomeSectionCardHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatBudgetPeriodLabel } from "@/lib/budget-period";
import { formatMoney } from "@/lib/format-money";
import { t } from "@/lib/i18n";
import { hasPartnerBudget, myDisplayName, partnerDisplayName } from "@/lib/owner-labels";
import { CHART_HIDDEN_KEY } from "@/lib/storage-reset";
import {
  useBudgetPeriod,
  usePeriodCategoryBreakdown,
  usePeriodOwnerExpenseBreakdown,
  usePeriodOwnerTotals,
  usePeriodTypeCategoryBreakdown,
  useStore,
} from "@/store/useStore";

function readHidden(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(CHART_HIDDEN_KEY) === "1";
  } catch {
    return false;
  }
}

function writeHidden(hidden: boolean): void {
  try {
    if (hidden) localStorage.setItem(CHART_HIDDEN_KEY, "1");
    else localStorage.removeItem(CHART_HIDDEN_KEY);
  } catch {
    /* ignore */
  }
}

const CHART_COLORS = [
  "#22c55e",
  "#3b82f6",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#64748b",
];

const tooltipStyle = {
  contentStyle: {
    background: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "8px",
    color: "hsl(var(--foreground))",
    fontSize: 12,
  },
  itemStyle: { color: "hsl(var(--foreground))" },
};

type PieData = { category: string; value: number }[];

function CategoryPie({
  data,
  title,
  compact,
}: {
  data: PieData;
  title: string;
  compact?: boolean;
}) {
  const locale = useStore((s) => s.locale);

  if (data.length === 0) {
    return (
      <div className="flex min-h-[200px] flex-col">
        {title ? (
          <p className="mb-2 text-center text-xs font-medium text-muted-foreground">{title}</p>
        ) : null}
        <p className="flex flex-1 items-center justify-center text-center text-xs text-muted-foreground">
          {t(locale, "chartEmpty")}
        </p>
      </div>
    );
  }

  const outer = compact ? 56 : 72;
  const inner = compact ? 22 : 28;
  const height = compact ? 200 : 260;

  return (
    <div className="min-w-0 flex-1">
      {title ? (
        <p className="mb-1 truncate text-center text-xs font-medium text-muted-foreground">{title}</p>
      ) : null}
      <div className="mx-auto w-full min-w-0" style={{ height }}>
        <ResponsiveContainer width="100%" height={height}>
          <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
            <Pie
              data={data}
              dataKey="value"
              nameKey="category"
              cx="50%"
              cy="42%"
              outerRadius={outer}
              innerRadius={inner}
              paddingAngle={2}
            >
              {data.map((entry, index) => (
                <Cell
                  key={entry.category}
                  fill={CHART_COLORS[index % CHART_COLORS.length]}
                  stroke="transparent"
                />
              ))}
            </Pie>
            <Tooltip
              {...tooltipStyle}
              formatter={(value: number, _name, item) => {
                const cat = (item.payload as { category?: string })?.category ?? "";
                return [`${value.toLocaleString()}`, cat];
              }}
            />
            {!compact && (
              <Legend
                layout="horizontal"
                verticalAlign="bottom"
                wrapperStyle={{
                  fontSize: 10,
                  paddingTop: 4,
                  color: "hsl(var(--foreground))",
                }}
              />
            )}
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function TotalsPanel({
  variant,
}: {
  variant: "expense" | "income";
}) {
  const locale = useStore((s) => s.locale);
  const userName = useStore((s) => s.userName);
  const partnerName = useStore((s) => s.partnerName);
  const totals = usePeriodOwnerTotals();
  const categories = usePeriodTypeCategoryBreakdown(variant === "expense" ? "expense" : "income");
  const [showCategories, setShowCategories] = useState(true);

  const showPartner = hasPartnerBudget(partnerName);
  const partnerLabel = partnerDisplayName(partnerName);
  const meLabel = myDisplayName(locale, userName);
  const meAmount = variant === "expense" ? totals.me.expense : totals.me.income;
  const partnerAmount = variant === "expense" ? totals.partner.expense : totals.partner.income;
  const total = meAmount + partnerAmount;
  const primaryAmount = showPartner ? meAmount : total;
  const primaryLabel = showPartner ? meLabel : t(locale, "filterAll");
  const color =
    variant === "income"
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-rose-600 dark:text-rose-400";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="text-muted-foreground">{primaryLabel}</span>
        <span className={`font-semibold tabular-nums ${color}`}>
          {formatMoney(primaryAmount, locale)} {t(locale, "currency")}
        </span>
      </div>
      {showPartner ? (
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="text-muted-foreground">{partnerLabel}</span>
          <span className={`font-semibold tabular-nums ${color}`}>
            {formatMoney(partnerAmount, locale)} {t(locale, "currency")}
          </span>
        </div>
      ) : null}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full text-xs"
        onClick={() => setShowCategories((v) => !v)}
      >
        {showCategories ? t(locale, "summaryHideCategories") : t(locale, "summaryByCategories")}
      </Button>
      {showCategories ? (
        categories.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t(locale, "summaryCategoriesEmpty")}</p>
        ) : (
          <ul className="space-y-1.5 border-t pt-2">
            {categories.map((row, index) => {
              const pct = total > 0 ? Math.round((row.value / total) * 100) : 0;
              return (
                <li key={row.category} className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="min-w-0 truncate text-muted-foreground">
                    <span className="mr-1.5 tabular-nums text-foreground/50">{index + 1}.</span>
                    {row.category}
                  </span>
                  <span className={`shrink-0 tabular-nums font-medium ${color}`}>
                    {formatMoney(row.value, locale)} {pct > 0 ? `(${pct}%)` : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        )
      ) : null}
    </div>
  );
}

export function FinancialChart() {
  const locale = useStore((s) => s.locale);
  const userName = useStore((s) => s.userName);
  const partnerName = useStore((s) => s.partnerName);
  const period = useBudgetPeriod();
  const breakdownAll = usePeriodCategoryBreakdown();
  const breakdownMe = usePeriodOwnerExpenseBreakdown("me");
  const breakdownPartner = usePeriodOwnerExpenseBreakdown("partner");
  const periodTotals = usePeriodOwnerTotals();
  const [mounted, setMounted] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [tab, setTab] = useState("categories");

  const dualMode = hasPartnerBudget(partnerName);
  const periodLabel = formatBudgetPeriodLabel(period, locale);

  const hasCategoryData = useMemo(() => {
    if (dualMode) return breakdownMe.length > 0 || breakdownPartner.length > 0;
    return breakdownAll.length > 0;
  }, [dualMode, breakdownAll.length, breakdownMe.length, breakdownPartner.length]);

  const hasExpenseData = periodTotals.me.expense + periodTotals.partner.expense > 0;
  const hasIncomeData = periodTotals.me.income + periodTotals.partner.income > 0;
  const hasAnyData = hasCategoryData || hasExpenseData || hasIncomeData;

  useEffect(() => {
    setMounted(true);
    setHidden(readHidden());
  }, []);

  const show = useCallback(() => {
    setHidden(false);
    writeHidden(false);
  }, []);

  const hide = useCallback(() => {
    setHidden(true);
    writeHidden(true);
  }, []);

  const title = t(locale, "chartTitle");

  if (!mounted) {
    return (
      <Card className="border-primary/20">
        <HomeSectionCardHeader icon={BarChart3} title={title} />
        <CardContent>
          <div className="h-[240px] w-full animate-pulse rounded-md bg-muted" />
        </CardContent>
      </Card>
    );
  }

  if (hidden) {
    return (
      <HomeSectionCollapsedBar
        icon={BarChart3}
        title={title}
        action={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={sectionToggleButtonClassName}
            onClick={show}
          >
            <ChevronDown className="h-4 w-4" />
            {t(locale, "summaryShow")}
          </Button>
        }
      />
    );
  }

  const partnerLabel =
    partnerDisplayName(partnerName) || t(locale, "chartTitlePartner");
  const meChartLabel = myDisplayName(locale, userName);

  return (
    <Card className="border-primary/20">
      <HomeSectionCardHeader
        icon={BarChart3}
        title={title}
        subtitle={t(locale, "chartPeriod", { period: periodLabel })}
        action={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={sectionToggleButtonClassName}
            onClick={hide}
          >
            <ChevronUp className="h-4 w-4" />
            {t(locale, "summaryHide")}
          </Button>
        }
      />
      <CardContent className={`overflow-hidden ${homeSectionContentClassName}`}>
        {!hasAnyData ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t(locale, "chartEmpty")}</p>
        ) : (
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="mb-3 grid w-full grid-cols-3">
              <TabsTrigger value="categories">{t(locale, "chartTabCategories")}</TabsTrigger>
              <TabsTrigger value="expenses">
                <TrendingDown className="mr-1 inline h-3.5 w-3.5" />
                {t(locale, "chartTabExpenses")}
              </TabsTrigger>
              <TabsTrigger value="income">
                <TrendingUp className="mr-1 inline h-3.5 w-3.5" />
                {t(locale, "chartTabIncome")}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="categories">
              {hasCategoryData ? (
                dualMode ? (
                  <div className="grid grid-cols-2 gap-2">
                    <CategoryPie data={breakdownMe} title={meChartLabel} compact />
                    <CategoryPie data={breakdownPartner} title={partnerLabel} compact />
                  </div>
                ) : (
                  <CategoryPie data={breakdownAll} title="" />
                )
              ) : (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {t(locale, "chartEmpty")}
                </p>
              )}
            </TabsContent>

            <TabsContent value="expenses">
              {hasExpenseData ? (
                <TotalsPanel variant="expense" />
              ) : (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {t(locale, "chartEmpty")}
                </p>
              )}
            </TabsContent>

            <TabsContent value="income">
              {hasIncomeData ? (
                <TotalsPanel variant="income" />
              ) : (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {t(locale, "chartEmpty")}
                </p>
              )}
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
