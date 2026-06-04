"use client";

import { ChevronDown, ChevronUp, Pencil, PiggyBank, Shield, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  HomeSectionCardHeader,
  HomeSectionCollapsedBar,
  homeSectionContentClassName,
  sectionToggleButtonClassName,
} from "@/components/HomeSectionCardHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getCategoryLabel,
  getFallbackCategoryId,
  sortCategoriesByLabel,
} from "@/lib/categories";
import { formatBudgetPeriodLabel, getCurrentBudgetPeriod } from "@/lib/budget-period";
import { formatMoney } from "@/lib/format-money";
import { formatPlanningDeadline, formatTransactionDate } from "@/lib/format-date";
import {
  avgMonthlyExpenses,
  budgetUsagePercent,
  emergencyTargetAmount,
  goalProgressPercent,
  monthSpentByCategory,
  resolveGoalMonthlyPlans,
  resolveGoalTarget,
  todayIso,
} from "@/lib/planning/analytics";
import type { GoalMonthlyPlans } from "@/lib/planning/analytics";
import {
  recurringDisplayName,
  skippedPaymentTotal,
} from "@/lib/planning/recurring-skipped";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useCategories, useStore, useTransactions } from "@/store/useStore";
import type { Locale } from "@/types";
import { EMERGENCY_GOAL_ID } from "@/types/planning";
import type { RecurringFrequency, SavingsGoal } from "@/types/planning";

function replaceTokens(template: string, tokens: Record<string, string>): string {
  let s = template;
  for (const [key, value] of Object.entries(tokens)) {
    s = s.split(`{${key}}`).join(value);
  }
  return s;
}

function GoalMonthlyPlansBlock({
  plans,
  deadline,
  locale,
}: {
  plans: GoalMonthlyPlans;
  deadline: string | null;
  locale: Locale;
}) {
  return (
    <div className="mt-0.5 space-y-0.5">
      {deadline ? (
        <p className="text-xs text-muted-foreground">
          {replaceTokens(t(locale, "planningGoalUntil"), {
            date: formatPlanningDeadline(deadline, locale),
          })}
          {" · "}
          {replaceTokens(t(locale, "planningGoalMonthsLeft"), {
            months: String(plans.months),
          })}
        </p>
      ) : null}
      <p className="text-xs text-muted-foreground">
        {replaceTokens(t(locale, "planningGoalMonthlyOnAccount"), {
          amount: formatMoney(plans.onAccount, locale),
        })}
      </p>
      <p className="text-xs font-medium text-primary">
        {replaceTokens(t(locale, "planningGoalMonthlyIfInvested"), {
          amount: formatMoney(plans.ifInvested, locale),
        })}
      </p>
    </div>
  );
}

function ProgressBar({ percent, over }: { percent: number; over?: boolean }) {
  const width = Math.min(100, Math.max(0, percent));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={`h-full transition-all ${over ? "bg-destructive" : "bg-primary"}`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

export function PlanningPanel() {
  const locale = useStore((s) => s.locale);
  const transactions = useTransactions();
  const categories = useCategories();
  const savingsGoals = useStore((s) => s.savingsGoals);
  const categoryBudgets = useStore((s) => s.categoryBudgets);
  const recurringTransactions = useStore((s) => s.recurringTransactions);
  const addGoal = useStore((s) => s.addGoal);
  const updateGoal = useStore((s) => s.updateGoal);
  const depositGoal = useStore((s) => s.depositGoal);
  const revertLastGoalDeposit = useStore((s) => s.revertLastGoalDeposit);
  const removeGoal = useStore((s) => s.removeGoal);
  const enableEmergencyFund = useStore((s) => s.enableEmergencyFund);
  const setCategoryBudget = useStore((s) => s.setCategoryBudget);
  const removeCategoryBudget = useStore((s) => s.removeCategoryBudget);
  const addRecurring = useStore((s) => s.addRecurring);
  const updateRecurring = useStore((s) => s.updateRecurring);
  const removeRecurring = useStore((s) => s.removeRecurring);
  const entryOwner = useStore((s) => s.entryOwner);
  const budgetMonthStartDay = useStore((s) => s.budgetMonthStartDay);
  const setBudgetMonthStartDay = useStore((s) => s.setBudgetMonthStartDay);
  const collapsed = useStore((s) => s.planningPanelCollapsed);
  const setPlanningPanelCollapsed = useStore((s) => s.setPlanningPanelCollapsed);

  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const finish = () => setHydrated(true);
    if (useStore.persist.hasHydrated()) {
      finish();
      return;
    }
    return useStore.persist.onFinishHydration(finish);
  }, []);

  const open = hydrated && !collapsed;

  const toggleOpen = useCallback(() => {
    setPlanningPanelCollapsed(!useStore.getState().planningPanelCollapsed);
  }, [setPlanningPanelCollapsed]);
  const [goalName, setGoalName] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalDeadline, setGoalDeadline] = useState("");
  const [depositGoalId, setDepositGoalId] = useState<string | null>(null);
  const [depositAmount, setDepositAmount] = useState("");
  const [editGoalId, setEditGoalId] = useState<string | null>(null);
  const [editGoalTarget, setEditGoalTarget] = useState("");
  const [editGoalDeadline, setEditGoalDeadline] = useState("");
  const [limitCategoryId, setLimitCategoryId] = useState("");
  const [limitAmount, setLimitAmount] = useState("");
  const [recAmount, setRecAmount] = useState("");
  const [recNote, setRecNote] = useState("");
  const [recFrequency, setRecFrequency] = useState<RecurringFrequency>("monthly");
  const [recStartDate, setRecStartDate] = useState(() => todayIso());

  const customGoals = savingsGoals.filter((g) => g.kind !== "emergency");
  const emergencyGoal = savingsGoals.find((g) => g.id === EMERGENCY_GOAL_ID || g.kind === "emergency");
  const expenseCategories = useMemo(
    () => sortCategoriesByLabel(categories.filter((c) => c.type === "expense"), categories, locale),
    [categories, locale],
  );
  const sortedCategoryBudgets = useMemo(
    () =>
      [...categoryBudgets].sort((a, b) =>
        getCategoryLabel(a.categoryId, categories, locale).localeCompare(
          getCategoryLabel(b.categoryId, categories, locale),
          locale === "ru" ? "ru" : "en",
          { sensitivity: "base" },
        ),
      ),
    [categoryBudgets, categories, locale],
  );
  const avgMonthly = useMemo(() => avgMonthlyExpenses(transactions), [transactions]);
  const budgetPeriodLabel = useMemo(
    () => formatBudgetPeriodLabel(getCurrentBudgetPeriod(budgetMonthStartDay), locale),
    [budgetMonthStartDay, locale],
  );

  const editingGoal = editGoalId
    ? customGoals.find((g) => g.id === editGoalId) ?? null
    : null;

  const createMonthlyPreview = useMemo(() => {
    const target = goalTarget ? Number(goalTarget.replace(/\s/g, "")) : 0;
    const deadline = goalDeadline.trim() || null;
    return resolveGoalMonthlyPlans(target, 0, deadline);
  }, [goalTarget, goalDeadline]);

  const editMonthlyPreview = useMemo(() => {
    if (!editingGoal) return null;
    const target = editGoalTarget ? Number(editGoalTarget.replace(/\s/g, "")) : 0;
    const deadline = editGoalDeadline.trim() || null;
    return resolveGoalMonthlyPlans(target, editingGoal.savedAmount, deadline);
  }, [editingGoal, editGoalTarget, editGoalDeadline]);

  const handleAddGoal = () => {
    const name = goalName.trim();
    if (!name) return;
    const target = goalTarget ? Number(goalTarget.replace(/\s/g, "")) : 0;
    addGoal(name, target > 0 ? target : 0, goalDeadline.trim() || null);
    setGoalName("");
    setGoalTarget("");
    setGoalDeadline("");
  };

  const handleDeposit = (id: string) => {
    const raw = depositAmount.replace(/\s/g, "");
    const amount = Number(raw);
    if (!raw.trim()) return;
    if (!amount) {
      revertLastGoalDeposit(id);
      setDepositAmount("");
      setDepositGoalId(null);
      return;
    }
    depositGoal(id, amount);
    setDepositAmount("");
    setDepositGoalId(null);
  };

  const handleSaveGoalEdit = (id: string) => {
    const target = editGoalTarget ? Number(editGoalTarget.replace(/\s/g, "")) : 0;
    updateGoal(id, {
      targetAmount: target > 0 ? target : 0,
      deadline: editGoalDeadline.trim() || null,
    });
    setEditGoalId(null);
    setEditGoalTarget("");
    setEditGoalDeadline("");
  };

  const startEditGoal = (goal: SavingsGoal, displayTarget: number) => {
    setEditGoalId(goal.id);
    setEditGoalTarget(displayTarget > 0 ? String(displayTarget) : "");
    setEditGoalDeadline(goal.deadline ?? "");
    setDepositGoalId(null);
  };

  const handleSetLimit = () => {
    const amount = Number(limitAmount.replace(/\s/g, ""));
    if (!limitCategoryId || !amount) return;
    setCategoryBudget(limitCategoryId, amount);
    setLimitAmount("");
  };

  const handleAddRecurring = () => {
    const amount = Number(recAmount.replace(/\s/g, ""));
    if (!amount || !recStartDate) return;
    const start = new Date(`${recStartDate}T12:00:00`);
    const dayOfMonth = recFrequency === "monthly" ? start.getDate() : null;
    addRecurring({
      amount,
      type: "expense",
      categoryId: getFallbackCategoryId("expense"),
      note: recNote.trim(),
      owner: entryOwner,
      frequency: recFrequency,
      dayOfMonth,
      nextRunDate: recStartDate,
    });
    setRecAmount("");
    setRecNote("");
  };

  const handleRecurringDateChange = (id: string, date: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    const d = new Date(`${date}T12:00:00`);
    const item = recurringTransactions.find((r) => r.id === id);
    if (!item) return;
    updateRecurring(id, {
      nextRunDate: date,
      dayOfMonth: item.frequency === "monthly" ? d.getDate() : item.dayOfMonth,
    });
  };

  const showToggle = (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={sectionToggleButtonClassName}
      onClick={toggleOpen}
    >
      {open && hydrated ? (
        <>
          <ChevronUp className="h-4 w-4" />
          {t(locale, "planningHide")}
        </>
      ) : (
        <>
          <ChevronDown className="h-4 w-4" />
          {t(locale, "planningShow")}
        </>
      )}
    </Button>
  );

  if (hydrated && !open) {
    return (
      <div data-onboarding="planning">
        <HomeSectionCollapsedBar
          icon={PiggyBank}
          title={t(locale, "planningTitle")}
          action={showToggle}
        />
      </div>
    );
  }

  return (
    <Card className="border-primary/20" data-onboarding="planning">
      <HomeSectionCardHeader
        icon={PiggyBank}
        title={t(locale, "planningTitle")}
        action={showToggle}
      />
      {open ? (
        <CardContent className={homeSectionContentClassName}>
          <Tabs defaultValue="goals">
            <TabsList className="mb-3 grid w-full grid-cols-4">
              <TabsTrigger value="goals">{t(locale, "planningTabGoals")}</TabsTrigger>
              <TabsTrigger value="limits">{t(locale, "planningTabLimits")}</TabsTrigger>
              <TabsTrigger value="emergency">{t(locale, "planningTabEmergency")}</TabsTrigger>
              <TabsTrigger value="recurring">{t(locale, "planningTabRecurring")}</TabsTrigger>
            </TabsList>

            <TabsContent value="goals" className="space-y-3">
              {customGoals.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t(locale, "planningGoalEmpty")}</p>
              ) : (
                customGoals.map((goal) => {
                  const target = resolveGoalTarget(goal, transactions);
                  const percent = goalProgressPercent(goal, transactions);
                  const remaining = Math.max(0, target - goal.savedAmount);
                  const monthlyPlans = resolveGoalMonthlyPlans(
                    target,
                    goal.savedAmount,
                    goal.deadline,
                  );
                  return (
                    <div key={goal.id} className="space-y-2 rounded-lg border p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">{goal.name}</p>
                          {monthlyPlans ? (
                            <GoalMonthlyPlansBlock
                              plans={monthlyPlans}
                              deadline={goal.deadline}
                              locale={locale}
                            />
                          ) : null}
                          <p className="text-xs text-muted-foreground">
                            {target > 0
                              ? replaceTokens(t(locale, "planningGoalSaved"), {
                                  saved: formatMoney(goal.savedAmount, locale),
                                  target: formatMoney(target, locale),
                                  percent: String(percent),
                                })
                              : replaceTokens(t(locale, "planningGoalSavedNoTarget"), {
                                  saved: formatMoney(goal.savedAmount, locale),
                                })}
                          </p>
                          {remaining > 0 ? (
                            <p className="text-xs text-muted-foreground">
                              {replaceTokens(t(locale, "planningGoalRemaining"), {
                                amount: formatMoney(remaining, locale),
                              })}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            onClick={() => startEditGoal(goal, target)}
                            aria-label={t(locale, "planningGoalEdit")}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 text-destructive"
                            onClick={() => removeGoal(goal.id)}
                            aria-label={t(locale, "planningGoalDelete")}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <ProgressBar percent={percent} />
                      {editGoalId === goal.id ? (
                        <div className="flex flex-col gap-2">
                          <div className="flex flex-wrap gap-2">
                            <Input
                              type="number"
                              placeholder={t(locale, "planningGoalTarget")}
                              value={editGoalTarget}
                              onChange={(e) => setEditGoalTarget(e.target.value)}
                            />
                            <Input
                              type="date"
                              aria-label={t(locale, "planningGoalDeadline")}
                              value={editGoalDeadline}
                              onChange={(e) => setEditGoalDeadline(e.target.value)}
                            />
                          </div>
                          {editGoalId === goal.id && editMonthlyPreview ? (
                            <GoalMonthlyPlansBlock
                              plans={editMonthlyPreview}
                              deadline={editGoalDeadline.trim() || null}
                              locale={locale}
                            />
                          ) : null}
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleSaveGoalEdit(goal.id)}
                            >
                              {t(locale, "planningGoalEditSave")}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditGoalId(null)}
                            >
                              {t(locale, "cancel")}
                            </Button>
                          </div>
                        </div>
                      ) : null}
                      {depositGoalId === goal.id ? (
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            placeholder={t(locale, "planningGoalDepositAmount")}
                            value={depositAmount}
                            onChange={(e) => setDepositAmount(e.target.value)}
                          />
                          <Button size="sm" onClick={() => handleDeposit(goal.id)}>
                            OK
                          </Button>
                        </div>
                      ) : null}
                      {depositGoalId === goal.id ? (
                        <p className="text-[11px] text-muted-foreground">
                          {t(locale, "planningGoalDepositUndo")}
                        </p>
                      ) : null}
                      {depositGoalId !== goal.id ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDepositGoalId(goal.id)}
                        >
                          {t(locale, "planningGoalDeposit")}
                        </Button>
                      ) : null}
                    </div>
                  );
                })
              )}
              <div className="flex flex-col gap-2 border-t pt-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <Input
                    placeholder={t(locale, "planningGoalName")}
                    value={goalName}
                    onChange={(e) => setGoalName(e.target.value)}
                    className="sm:min-w-[8rem] sm:flex-1"
                  />
                  <Input
                    type="number"
                    placeholder={t(locale, "planningGoalTarget")}
                    value={goalTarget}
                    onChange={(e) => setGoalTarget(e.target.value)}
                    className="sm:w-32"
                  />
                  <Input
                    type="date"
                    aria-label={t(locale, "planningGoalDeadline")}
                    value={goalDeadline}
                    onChange={(e) => setGoalDeadline(e.target.value)}
                    className="sm:w-40"
                  />
                </div>
                {createMonthlyPreview ? (
                  <GoalMonthlyPlansBlock
                    plans={createMonthlyPreview}
                    deadline={goalDeadline.trim() || null}
                    locale={locale}
                  />
                ) : null}
                <Button className="sm:self-start" onClick={handleAddGoal}>
                  {t(locale, "planningGoalAdd")}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="limits" className="space-y-3">
              <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
                <p className="text-sm font-medium">{t(locale, "budgetMonthStart")}</p>
                <p className="text-xs text-muted-foreground">{t(locale, "budgetMonthStartHint")}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">{t(locale, "budgetMonthStartDay")}</span>
                    <select
                      className="flex h-9 rounded-md border border-input bg-background px-2 text-sm"
                      value={budgetMonthStartDay}
                      onChange={(e) => setBudgetMonthStartDay(Number(e.target.value))}
                    >
                      {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </label>
                  <span className="text-xs text-muted-foreground">
                    {t(locale, "chartPeriod", { period: budgetPeriodLabel })}
                  </span>
                </div>
              </div>
              {categoryBudgets.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t(locale, "planningLimitEmpty")}</p>
              ) : (
                sortedCategoryBudgets.map((budget) => {
                  const spent = monthSpentByCategory(
                    transactions,
                    budget.categoryId,
                    budgetMonthStartDay,
                  );
                  const percent = budgetUsagePercent(spent, budget.monthlyLimit);
                  const over = spent > budget.monthlyLimit;
                  const label = getCategoryLabel(budget.categoryId, categories, locale);
                  return (
                    <div key={budget.categoryId} className="space-y-2 rounded-lg border p-3">
                      <div className="flex items-center justify-between">
                        <p className="font-medium">{label}</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeCategoryBudget(budget.categoryId)}
                        >
                          {t(locale, "planningLimitRemove")}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {replaceTokens(t(locale, "planningLimitSpent"), {
                          spent: formatMoney(spent, locale),
                          limit: formatMoney(budget.monthlyLimit, locale),
                          percent: String(percent),
                        })}
                      </p>
                      {over ? (
                        <p className="text-xs text-destructive">
                          {replaceTokens(t(locale, "planningLimitOver"), {
                            amount: formatMoney(spent - budget.monthlyLimit, locale),
                          })}
                        </p>
                      ) : null}
                      <ProgressBar percent={percent} over={over} />
                    </div>
                  );
                })
              )}
              <div className="flex flex-col gap-2 border-t pt-3 sm:flex-row">
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={limitCategoryId}
                  onChange={(e) => setLimitCategoryId(e.target.value)}
                >
                  <option value="">{t(locale, "planningLimitCategory")}</option>
                  {expenseCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {getCategoryLabel(c.id, categories, locale)}
                    </option>
                  ))}
                </select>
                <Input
                  type="number"
                  placeholder={t(locale, "planningLimitAmount")}
                  value={limitAmount}
                  onChange={(e) => setLimitAmount(e.target.value)}
                />
                <Button onClick={handleSetLimit}>{t(locale, "planningLimitSet")}</Button>
              </div>
            </TabsContent>

            <TabsContent value="emergency" className="space-y-3">
              <p className="text-sm text-muted-foreground">{t(locale, "planningEmergencyHint")}</p>
              <p className="text-sm">
                {replaceTokens(t(locale, "planningEmergencyAvg"), {
                  amount: formatMoney(avgMonthly, locale),
                })}
              </p>
              {!emergencyGoal ? (
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => enableEmergencyFund(3)}>
                    <Shield className="mr-2 h-4 w-4" />
                    {t(locale, "planningEmergencyEnable")} — {t(locale, "planningEmergencyMonths3")}
                  </Button>
                  <Button variant="outline" onClick={() => enableEmergencyFund(6)}>
                    {t(locale, "planningEmergencyMonths6")}
                  </Button>
                </div>
              ) : (
                <div className="space-y-2 rounded-lg border p-3">
                  <p className="font-medium">{t(locale, "planningEmergencyTitle")}</p>
                  <p className="text-xs text-muted-foreground">
                    {emergencyGoal.emergencyMonths === 3
                      ? t(locale, "planningEmergencyMonths3")
                      : t(locale, "planningEmergencyMonths6")}
                  </p>
                  {(() => {
                    const target = emergencyTargetAmount(
                      transactions,
                      emergencyGoal.emergencyMonths ?? 6,
                    );
                    const percent =
                      target > 0 ? Math.min(100, Math.round((emergencyGoal.savedAmount / target) * 100)) : 0;
                    return (
                      <>
                        <p className="text-sm">
                          {replaceTokens(t(locale, "planningEmergencyTarget"), {
                            amount: formatMoney(target, locale),
                          })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {replaceTokens(t(locale, "planningGoalSaved"), {
                            saved: formatMoney(emergencyGoal.savedAmount, locale),
                            target: formatMoney(target, locale),
                            percent: String(percent),
                          })}
                        </p>
                        <ProgressBar percent={percent} />
                      </>
                    );
                  })()}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => enableEmergencyFund(3)}
                    >
                      {t(locale, "planningEmergencyMonths3")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => enableEmergencyFund(6)}
                    >
                      {t(locale, "planningEmergencyMonths6")}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        setDepositGoalId(EMERGENCY_GOAL_ID);
                        if (!depositAmount) setDepositGoalId(EMERGENCY_GOAL_ID);
                      }}
                    >
                      {t(locale, "planningGoalDeposit")}
                    </Button>
                  </div>
                  {depositGoalId === EMERGENCY_GOAL_ID ? (
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        placeholder={t(locale, "planningGoalDepositAmount")}
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(e.target.value)}
                      />
                      <Button size="sm" onClick={() => handleDeposit(EMERGENCY_GOAL_ID)}>
                        OK
                      </Button>
                    </div>
                  ) : null}
                </div>
              )}
            </TabsContent>

            <TabsContent value="recurring" className="space-y-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                {t(locale, "planningRecurringHint")}
              </p>
              {recurringTransactions.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t(locale, "planningRecurringEmpty")}</p>
              ) : (
                recurringTransactions.map((item) => {
                  const categoryLabel = getCategoryLabel(item.categoryId, categories, locale);
                  const title = recurringDisplayName(item, categoryLabel);
                  const skipped = item.skippedDates ?? [];
                  const skipTotal = skippedPaymentTotal(item);
                  return (
                    <div
                      key={item.id}
                      className={cn(
                        "rounded-lg border p-3",
                        item.enabled
                          ? "border-emerald-200/80 bg-emerald-50/60 dark:border-emerald-900/50 dark:bg-emerald-950/25"
                          : "border-red-200/80 bg-red-50/60 dark:border-red-900/50 dark:bg-red-950/25",
                      )}
                    >
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                        <div className="min-w-0">
                          <p
                            className={cn(
                              "mb-1 inline-flex rounded-md px-2 py-0.5 text-xs font-medium",
                              item.enabled
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-100"
                                : "bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-100",
                            )}
                          >
                            {item.enabled
                              ? t(locale, "planningRecurringStatusActive")
                              : t(locale, "planningRecurringStatusPaused")}
                          </p>
                          <p className="font-medium leading-tight">{title}</p>
                          <p className="mt-0.5 text-sm font-semibold tabular-nums">
                            {formatMoney(item.amount, locale)}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {item.frequency === "weekly"
                              ? t(locale, "planningRecurringWeekly")
                              : item.frequency === "monthly"
                                ? t(locale, "planningRecurringMonthly")
                                : t(locale, "planningRecurringYearly")}
                            {" · "}
                            {replaceTokens(t(locale, "planningRecurringNext"), {
                              date: formatTransactionDate(item.nextRunDate, locale),
                            })}
                          </p>
                          <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="shrink-0">{t(locale, "planningRecurringDate")}</span>
                            <Input
                              type="date"
                              className="h-8 w-auto max-w-[10.5rem] text-xs"
                              value={item.nextRunDate}
                              onChange={(e) => handleRecurringDateChange(item.id, e.target.value)}
                            />
                          </label>
                        </div>
                        {skipped.length > 0 ? (
                          <div className="min-w-[8.5rem] rounded-md border border-amber-300/70 bg-amber-50/80 px-2.5 py-2 text-xs dark:border-amber-800/60 dark:bg-amber-950/40">
                            <p className="font-semibold text-amber-900 dark:text-amber-100">
                              {t(locale, "planningRecurringSkippedTitle")}
                            </p>
                            <ul className="mt-1 space-y-0.5 text-muted-foreground">
                              {skipped.map((d) => (
                                <li key={d} className="tabular-nums">
                                  {replaceTokens(t(locale, "planningRecurringSkippedLine"), {
                                    date: formatTransactionDate(d, locale),
                                  })}
                                </li>
                              ))}
                            </ul>
                            <p className="mt-1.5 font-semibold tabular-nums text-foreground">
                              {replaceTokens(t(locale, "planningRecurringSkippedTotal"), {
                                amount: formatMoney(skipTotal, locale),
                                count: String(skipped.length),
                              })}
                            </p>
                          </div>
                        ) : null}
                      </div>
                      <div className="mt-2 flex justify-end gap-1 border-t border-border/50 pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className={cn(
                            item.enabled
                              ? "border-emerald-300/80 bg-white/80 hover:bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40"
                              : "border-red-300/80 bg-white/80 hover:bg-red-50 dark:border-red-800 dark:bg-red-950/40",
                          )}
                          onClick={() => updateRecurring(item.id, { enabled: !item.enabled })}
                        >
                          {item.enabled
                            ? t(locale, "planningRecurringPause")
                            : t(locale, "planningRecurringResume")}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => removeRecurring(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
              <div className="space-y-2 border-t pt-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">
                      {t(locale, "planningRecurringAmount")}
                    </span>
                    <Input
                      type="number"
                      placeholder="0"
                      value={recAmount}
                      onChange={(e) => setRecAmount(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">
                      {t(locale, "planningRecurringName")}
                    </span>
                    <Input
                      placeholder={t(locale, "planningRecurringName")}
                      value={recNote}
                      onChange={(e) => setRecNote(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={recFrequency}
                    onChange={(e) => setRecFrequency(e.target.value as RecurringFrequency)}
                  >
                    <option value="weekly">{t(locale, "planningRecurringWeekly")}</option>
                    <option value="monthly">{t(locale, "planningRecurringMonthly")}</option>
                    <option value="yearly">{t(locale, "planningRecurringYearly")}</option>
                  </select>
                  <Input
                    type="date"
                    className="w-full sm:w-auto"
                    value={recStartDate}
                    onChange={(e) => setRecStartDate(e.target.value)}
                    aria-label={t(locale, "planningRecurringDate")}
                  />
                  <Button onClick={handleAddRecurring}>{t(locale, "planningRecurringAdd")}</Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      ) : null}
    </Card>
  );
}
