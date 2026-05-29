"use client";

import {
  ChevronDown,
  ChevronUp,
  Lightbulb,
  MessageCircle,
  Shuffle,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  HomeSectionCardHeader,
  HomeSectionCollapsedBar,
  homeSectionContentClassName,
  sectionToggleButtonClassName,
} from "@/components/HomeSectionCardHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AiAnalysisTab } from "@/components/AiAnalysisTab";
import { pickRandomMiniTips } from "@/lib/budget-mini-tips";
import { getAdvisorConfig } from "@/lib/advisor-config";
import { t } from "@/lib/i18n";
import { pickRandomPlanningTips } from "@/lib/planning-tips";
import {
  AI_RECOMMENDATIONS_HIDDEN_KEY,
  TIPS_PANEL_HIDDEN_KEY,
  WEEKLY_ANALYSIS_HIDDEN_KEY,
} from "@/lib/storage-reset";
import { useStore } from "@/store/useStore";

const TIP_COUNT = 3;

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
  const [tab, setTab] = useState("ai");
  const [miniTips, setMiniTips] = useState(() => pickRandomMiniTips(TIP_COUNT));
  const [planningTips, setPlanningTips] = useState(() =>
    pickRandomPlanningTips(locale, advisor, TIP_COUNT),
  );

  useEffect(() => {
    setHidden(readHidden());
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

  if (hidden) {
    return (
      <HomeSectionCollapsedBar
        icon={Sparkles}
        title={t(locale, "tipsPanelTitle")}
        action={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={sectionToggleButtonClassName}
            onClick={show}
          >
            <ChevronDown className="h-4 w-4" />
            {t(locale, "recommendationsShow")}
          </Button>
        }
      />
    );
  }

  return (
    <Card className="border-primary/20">
      <HomeSectionCardHeader
        icon={Sparkles}
        title={t(locale, "tipsPanelTitle")}
        action={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={sectionToggleButtonClassName}
            onClick={hide}
          >
            <ChevronUp className="h-4 w-4" />
            {t(locale, "recommendationsHide")}
          </Button>
        }
      />
      <CardContent className={homeSectionContentClassName}>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-3 grid w-full grid-cols-3">
            <TabsTrigger value="ai" className="gap-1 text-xs sm:text-sm">
              <Sparkles className="hidden h-3.5 w-3.5 sm:inline" />
              <span className="truncate">{t(locale, "tipsTabAi")}</span>
            </TabsTrigger>
            <TabsTrigger value="mini" className="gap-1 text-xs sm:text-sm">
              <MessageCircle className="hidden h-3.5 w-3.5 sm:inline" />
              <span className="truncate">{t(locale, "tipsTabMini")}</span>
            </TabsTrigger>
            <TabsTrigger value="planning" className="gap-1 text-xs sm:text-sm">
              <Lightbulb className="hidden h-3.5 w-3.5 sm:inline" />
              <span className="truncate">{t(locale, "tipsTabPlanning")}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ai">
            <AiAnalysisTab active={tab === "ai"} />
          </TabsContent>
          <TabsContent value="mini">
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
          </TabsContent>
          <TabsContent value="planning">
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
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
