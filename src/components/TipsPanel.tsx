"use client";

import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  Lightbulb,
  MessageCircle,
  Shuffle,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WeeklyAnalysisTab } from "@/components/WeeklyAnalysisTab";
import { pickRandomMiniTips } from "@/lib/budget-mini-tips";
import { getAdvisorConfig } from "@/lib/advisor-config";
import { t } from "@/lib/i18n";
import { pickRandomPlanningTips } from "@/lib/planning-tips";
import {
  AI_RECOMMENDATIONS_HIDDEN_KEY,
  TIPS_PANEL_HIDDEN_KEY,
  TIPS_TAB_ORDER_KEY,
  WEEKLY_ANALYSIS_HIDDEN_KEY,
} from "@/lib/storage-reset";
import { useStore } from "@/store/useStore";

const TIP_COUNT = 3;
const DEFAULT_TAB_ORDER = ["ai", "mini", "planning"] as const;
type TipsTabId = (typeof DEFAULT_TAB_ORDER)[number];

function isTipsTabId(v: string): v is TipsTabId {
  return (DEFAULT_TAB_ORDER as readonly string[]).includes(v);
}

function readTabOrder(): TipsTabId[] {
  if (typeof window === "undefined") return [...DEFAULT_TAB_ORDER];
  try {
    const raw = localStorage.getItem(TIPS_TAB_ORDER_KEY);
    if (!raw) return [...DEFAULT_TAB_ORDER];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [...DEFAULT_TAB_ORDER];
    const ids = parsed.filter((x): x is TipsTabId => typeof x === "string" && isTipsTabId(x));
    const missing = DEFAULT_TAB_ORDER.filter((id) => !ids.includes(id));
    return [...ids, ...missing];
  } catch {
    return [...DEFAULT_TAB_ORDER];
  }
}

function writeTabOrder(order: TipsTabId[]): void {
  try {
    localStorage.setItem(TIPS_TAB_ORDER_KEY, JSON.stringify(order));
  } catch {
    /* ignore */
  }
}

function readHidden(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return (
      localStorage.getItem(TIPS_PANEL_HIDDEN_KEY) === "1" ||
      localStorage.getItem(AI_RECOMMENDATIONS_HIDDEN_KEY) === "1" ||
      localStorage.getItem(WEEKLY_ANALYSIS_HIDDEN_KEY) === "1"
    );
  } catch {
    return false;
  }
}

function writeHidden(hidden: boolean): void {
  try {
    if (hidden) {
      localStorage.setItem(TIPS_PANEL_HIDDEN_KEY, "1");
      localStorage.setItem(AI_RECOMMENDATIONS_HIDDEN_KEY, "1");
      localStorage.setItem(WEEKLY_ANALYSIS_HIDDEN_KEY, "1");
    } else {
      localStorage.removeItem(TIPS_PANEL_HIDDEN_KEY);
      localStorage.removeItem(AI_RECOMMENDATIONS_HIDDEN_KEY);
      localStorage.removeItem(WEEKLY_ANALYSIS_HIDDEN_KEY);
    }
  } catch {
    /* ignore */
  }
}

export function TipsPanel() {
  const locale = useStore((s) => s.locale);
  const advisor = useMemo(() => getAdvisorConfig(), []);
  const [hidden, setHidden] = useState(false);
  const [tab, setTab] = useState<TipsTabId>("ai");
  const [tabOrder, setTabOrder] = useState<TipsTabId[]>(() => [...DEFAULT_TAB_ORDER]);
  const [dragId, setDragId] = useState<TipsTabId | null>(null);
  const [miniTips, setMiniTips] = useState(() => pickRandomMiniTips(TIP_COUNT));
  const [planningTips, setPlanningTips] = useState(() =>
    pickRandomPlanningTips(locale, advisor, TIP_COUNT),
  );

  useEffect(() => {
    setHidden(readHidden());
    const order = readTabOrder();
    setTabOrder(order);
    setTab(order[0] ?? "ai");
  }, []);

  useEffect(() => {
    setPlanningTips(pickRandomPlanningTips(locale, advisor, TIP_COUNT));
  }, [locale, advisor]);

  const shuffleMini = useCallback(() => {
    setMiniTips(pickRandomMiniTips(TIP_COUNT));
  }, []);

  const shufflePlanning = useCallback(() => {
    setPlanningTips(pickRandomPlanningTips(locale, advisor, TIP_COUNT));
  }, [locale, advisor]);

  const show = useCallback(() => {
    setHidden(false);
    writeHidden(false);
  }, []);

  const hide = useCallback(() => {
    setHidden(true);
    writeHidden(true);
  }, []);

  const reorderTabs = useCallback((source: TipsTabId, target: TipsTabId) => {
    if (source === target) return;
    setTabOrder((prev) => {
      const next = prev.filter((id) => id !== source);
      const targetIdx = next.indexOf(target);
      next.splice(targetIdx, 0, source);
      writeTabOrder(next);
      return next;
    });
  }, []);

  const tabLabel = (id: TipsTabId) => {
    if (id === "ai") return t(locale, "tipsTabAi");
    if (id === "mini") return t(locale, "tipsTabMini");
    return t(locale, "tipsTabPlanning");
  };

  const tabIcon = (id: TipsTabId) => {
    if (id === "ai") return Sparkles;
    if (id === "mini") return MessageCircle;
    return Lightbulb;
  };

  if (hidden) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-primary/20 px-3 py-2.5">
        <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
          <Sparkles className="h-4 w-4 shrink-0 text-primary" />
          <span className="truncate">{t(locale, "tipsPanelTitle")}</span>
        </span>
        <Button type="button" variant="ghost" size="sm" className="shrink-0 gap-1" onClick={show}>
          <ChevronDown className="h-4 w-4" />
          {t(locale, "recommendationsShow")}
        </Button>
      </div>
    );
  }

  return (
    <Card className="border-primary/20">
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="flex min-w-0 items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 shrink-0 text-primary" />
          <span className="truncate">{t(locale, "tipsPanelTitle")}</span>
        </CardTitle>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 shrink-0 gap-1 px-2 text-xs"
          onClick={hide}
        >
          <ChevronUp className="h-4 w-4" />
          {t(locale, "recommendationsHide")}
        </Button>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="mb-2 text-xs text-muted-foreground">{t(locale, "tipsTabDragHint")}</p>
        <Tabs value={tab} onValueChange={(v) => setTab(v as TipsTabId)}>
          <TabsList
            className="mb-3 flex h-auto w-full gap-1 p-1"
            style={{ display: "grid", gridTemplateColumns: `repeat(${tabOrder.length}, 1fr)` }}
          >
            {tabOrder.map((id) => {
              const Icon = tabIcon(id);
              return (
                <TabsTrigger
                  key={id}
                  value={id}
                  draggable
                  onDragStart={() => setDragId(id)}
                  onDragEnd={() => setDragId(null)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragId) reorderTabs(dragId, id);
                    setDragId(null);
                  }}
                  className={`gap-0.5 px-1 text-xs sm:gap-1 sm:px-2 sm:text-sm ${
                    dragId === id ? "opacity-50" : ""
                  }`}
                >
                  <GripVertical className="h-3 w-3 shrink-0 opacity-40" aria-hidden />
                  <Icon className="hidden h-3.5 w-3.5 sm:inline" />
                  <span className="truncate">{tabLabel(id)}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {tabOrder.map((id) => (
            <TabsContent key={id} value={id}>
              {id === "ai" ? <WeeklyAnalysisTab active={tab === "ai"} /> : null}
              {id === "mini" ? (
                <div className="space-y-2">
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1 px-2 text-xs"
                      onClick={shuffleMini}
                    >
                      <Shuffle className="h-4 w-4" />
                      {t(locale, "quotesShuffle")}
                    </Button>
                  </div>
                  <ul className="space-y-2 text-sm">
                    {miniTips.map((tip) => (
                      <li
                        key={tip}
                        className="rounded-md bg-secondary/60 p-2.5 leading-snug text-foreground/90"
                      >
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {id === "planning" ? (
                <div className="space-y-2">
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1 px-2 text-xs"
                      onClick={shufflePlanning}
                    >
                      <Lightbulb className="h-4 w-4 text-amber-500" />
                      {t(locale, "planningTipsShuffle")}
                    </Button>
                  </div>
                  <ul className="space-y-2 text-sm">
                    {planningTips.map((tip) => (
                      <li
                        key={tip}
                        className="rounded-md border border-amber-500/20 bg-amber-500/5 p-2.5 leading-snug text-foreground/90"
                      >
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
