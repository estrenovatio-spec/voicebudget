"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { t } from "@/lib/i18n";
import { useStore } from "@/store/useStore";

/** Статичный wireframe «Капитал» — без бэкенда, для согласования UX */
export default function CapitalPreviewPage() {
  const locale = useStore((s) => s.locale);

  return (
    <main className="mx-auto min-h-[var(--tg-viewport-height,100vh)] max-w-lg bg-background px-4 pb-10 pt-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/">{t(locale, "previewCapitalBack")}</Link>
        </Button>
        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-200">
          {t(locale, "previewCapitalBadge")}
        </span>
      </div>

      <h1 className="mb-4 text-xl font-bold">{t(locale, "previewCapitalTitle")}</h1>

      <div className="mb-3 flex gap-2">
        <Button size="sm" variant="default" className="flex-1">
          Семья
        </Button>
        <Button size="sm" variant="outline" className="flex-1 opacity-60">
          Бизнес
        </Button>
      </div>

      <Card className="mb-4 border-2 border-primary/25">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">🎯 Финансовый пульс</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="text-2xl font-bold tabular-nums">487 300 ₽</p>
          <p className="text-emerald-600 dark:text-emerald-400">▲ +12 400 ₽ за месяц</p>
          <div className="flex h-8 items-end gap-0.5 text-primary/60" aria-hidden>
            {["▁", "▂", "▃", "▅", "▆", "▇"].map((c, i) => (
              <span key={i} className="flex-1 text-center text-lg leading-none">
                {c}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      <p className="mb-2 text-sm font-medium">📦 3 контура</p>
      <div className="mb-4 grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-lg border-2 border-red-200 bg-red-50/80 p-2 dark:border-red-900 dark:bg-red-950/40">
          <p className="font-medium text-red-700 dark:text-red-300">Обязательные</p>
          <p className="mt-1 font-semibold tabular-nums">142к</p>
          <p className="text-muted-foreground">52%</p>
        </div>
        <div className="rounded-lg border-2 border-amber-200 bg-amber-50/80 p-2 dark:border-amber-900 dark:bg-amber-950/40">
          <p className="font-medium text-amber-800 dark:text-amber-200">Переменные</p>
          <p className="mt-1 font-semibold tabular-nums">68к</p>
          <p className="text-muted-foreground">25%</p>
        </div>
        <div className="rounded-lg border-2 border-emerald-200 bg-emerald-50/80 p-2 dark:border-emerald-900 dark:bg-emerald-950/40">
          <p className="font-medium text-emerald-800 dark:text-emerald-200">Капитал</p>
          <p className="mt-1 font-semibold tabular-nums">277к</p>
          <p className="text-muted-foreground">23%</p>
        </div>
      </div>

      <p className="mb-4 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
        💡 23% денежного потока уже работает на будущее. Позже: цели, инвестиции, проекты
        (квартира в аренду) — без перегруза главного экрана.
      </p>

      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">🐷 Активные цели</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {[
            { name: "🛡 Подушка", pct: 67, saved: "120 000", target: "180 000" },
            { name: "✈️ Отпуск", pct: 32, saved: "48 000", target: "150 000" },
          ].map((g) => (
            <div key={g.name}>
              <p className="font-medium">{g.name}</p>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary" style={{ width: `${g.pct}%` }} />
              </div>
              <p className="mt-1 text-muted-foreground tabular-nums">
                {g.saved} / {g.target} ₽
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="mb-4 opacity-90">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">📈 Инвестиции (скоро)</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Брокер, накопительный, крипто — ручной ввод или синхронизация. Отдельно: проекты с P&amp;L
          (затраты vs доход).
        </CardContent>
      </Card>
    </main>
  );
}
