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
import { getCategoryLabel, getFallbackCategoryId } from "@/lib/categories";
import { formatBudgetPeriodLabel, getCurrentBudgetPeriod } from "@/lib/budget-period";
import { formatMoney } from "@/lib/format-money";
import { formatTransactionDate } from "@/lib/format-date";
import {
  avgMonthlyExpenses,
  budgetUsagePercent,
  emergencyTargetAmount,
  goalProgressPercent,
  monthSpentByCategory,
  resolveGoalTarget,
  todayIso,
} from "@/lib/planning/analytics";
import { t } from "@/lib/i18n";
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

function formatGoalDeadline(iso: string, locale: Locale): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  if (locale === "en") return `${m}/${d}/${y}`;
  return `${d}.${m}.${y}`;
}

function goalPlanMeta(goal: SavingsGoal, locale: Locale): string | null {
  const parts: string[] = [];
  if (goal.deadline) {
    parts.push(
      replaceTokens(t(locale, "planningGoalUntil"), {
        date: formatGoalDeadline(goal.deadline, locale),
      }),
    );
  }
  if (goal.monthlyContribution && goal.monthlyContribution > 0) {
    parts.push(
      replaceTokens(t(locale, "planningGoalMonthlyPlan"), {
        amount: formatMoney(goal.monthlyContribution, locale),
      }),
    );
  }
  return parts.length > 0 ? parts.join(" · ") : null;
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
  const [goalMonthly, setGoalMonthly] = useState("");
  const [depositGoalId, setDepositGoalId] = useState<string | null>(null);
  const [depositAmount, setDepositAmount] = useState("");
  const [editGoalId, setEditGoalId] = useState<string | null>(null);
  const [editGoalTarget, setEditGoalTarget] = useState("");
  const [editGoalDeadline, setEditGoalDeadline] = useState("");
  const [editGoalMonthly, setEditGoalMonthly] = useState("");
  const [limitCategoryId, setLimitCategoryId] = useState("");
  const [limitAmount, setLimitAmount] = useState("");
  const [recAmount, setRecAmount] = useState("");
  const [recNote, setRecNote] = useState("");
  const [recFrequency, setRecFrequency] = useState<RecurringFrequency>("monthly");
  const [recStartDate, setRecStartDate] = useState(() => todayIso());

  const customGoals = savingsGoals.filter((g) => g.kind !== "emergency");
  const emergencyGoal = savingsGoals.find((g) => g.id === EMERGENCY_GOAL_ID || g.kind === "emergency");
  const expenseCategories = categories.filter((c) => c.type === "expense");
  const avgMonthly = useMemo(() => avgMonthlyExpenses(transactions), [transactions]);
  const budgetPeriodLabel = useMemo(
    () => formatBudgetPeriodLabel(getCurrentBudgetPeriod(budgetMonthStartDay), locale),
    [budgetMonthStartDay, locale],
  );

  const handleAddGoal = () => {
    const name = goalName.trim();
    if (!name) return;
    const target = goalTarget ? Number(goalTarget.replace(/\s/g, "")) : 0;
    const monthly = goalMonthly ? Number(goalMonthly.replace(/\s/g, "")) : null;
    addGoal(
      name,
      target > 0 ? target : 0,
      goalDeadline.trim() || null,
      monthly && monthly > 0 ? monthly : null,
    );
    setGoalName("");
    setGoalTarget("");
    setGoalDeadline("");
    setGoalMonthly("");
  };

  const handleDeposit = (id: string) => {
    const amount = Number(depositAmount.replace(/\s/g, ""));
    if (!amount) return;
    depositGoal(id, amount);
    setDepositAmount("");
    setDepositGoalId(null);
  };

  const handleSaveGoalEdit = (id: string) => {
    const target = editGoalTarget ? Number(editGoalTarget.replace(/\s/g, "")) : 0;
    const monthly = editGoalMonthly ? Number(editGoalMonthly.replace(/\s/g, "")) : null;
    updateGoal(id, {
      targetAmount: target > 0 ? target : 0,
      deadline: editGoalDeadline.trim() || null,
      monthlyContribution: monthly && monthly > 0 ? monthly : null,
    });
    setEditGoalId(null);
    setEditGoalTarget("");
    setEditGoalDeadline("");
    setEditGoalMonthly("");
  };

  const startEditGoal = (goal: SavingsGoal, displayTarget: number) => {
    setEditGoalId(goal.id);
    setEditGoalTarget(displayTarget > 0 ? String(displayTarget) : "");
    setEditGoalDeadline(goal.deadline ?? "");
    setEditGoalMonthly(
      goal.monthlyContribution && goal.monthlyContribution > 0
        ? String(goal.monthlyContribution)
        : "",
    );
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
      <HomeSectionCollapsedBar
        icon={PiggyBank}
        title={t(locale, "planningTitle")}
        action={showToggle}
      />
    );
  }

  return (
    <Card className="border-primary/20">
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
                  const planLine = goalPlanMeta(goal, locale);
                  return (
                    <div key={goal.id} className="space-y-2 rounded-lg border p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">{goal.name}</p>
                          {planLine ? (
                            <p className="text-xs text-muted-foreground">{planLine}</p>
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
                            <Input
                              type="number"
                              placeholder={t(locale, "planningGoalMonthly")}
                              value={editGoalMonthly}
                              onChange={(e) => setEditGoalMonthly(e.target.value)}
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => handleSaveGoalEdit(goal.id)}>
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
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDepositGoalId(goal.id)}
                        >
                          {t(locale, "planningGoalDeposit")}
                        </Button>
                      )}
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
                  <Input
                    type="number"
                    placeholder={t(locale, "planningGoalMonthly")}
                    value={goalMonthly}
                    onChange={(e) => setGoalMonthly(e.target.value)}
                    className="sm:w-36"
                  />
                </div>
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
                categoryBudgets.map((budget) => {
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
              {recurringTransactions.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t(locale, "planningRecurringEmpty")}</p>
              ) : (
                recurringTransactions.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">
                        {formatMoney(item.amount, locale)} —{" "}
                        {item.note || getCategoryLabel(item.categoryId, categories, locale)}
                      </p>
                      <p className="text-xs text-muted-foreground">
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
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateRecurring(item.id, { enabled: !item.enabled })}
                      >
                        {item.enabled
                          ? t(locale, "planningRecurringDisable")
                          : t(locale, "planningRecurringEnable")}
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
                ))
              )}
              <div className="space-y-2 border-t pt-3">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    type="number"
                    placeholder={t(locale, "planningRecurringAmount")}
                    value={recAmount}
                    onChange={(e) => setRecAmount(e.target.value)}
                  />
                  <Input
                    placeholder={t(locale, "planningRecurringNote")}
                    value={recNote}
                    onChange={(e) => setRecNote(e.target.value)}
                  />
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
