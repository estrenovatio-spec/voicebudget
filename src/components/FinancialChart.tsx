"use client";

import { useEffect, useState } from "react";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { t } from "@/lib/i18n";
import { useCategoryBreakdown, useStore } from "@/store/useStore";

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

export function FinancialChart() {
  const locale = useStore((s) => s.locale);
  const breakdown = useCategoryBreakdown(30);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t(locale, "chartTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[240px] w-full animate-pulse rounded-md bg-muted" />
        </CardContent>
      </Card>
    );
  }

  if (breakdown.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t(locale, "chartTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t(locale, "chartEmpty")}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t(locale, "chartTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="overflow-hidden">
        <div className="mx-auto h-[260px] w-full min-w-0 max-w-full">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <Pie
                data={breakdown}
                dataKey="value"
                nameKey="category"
                cx="50%"
                cy="45%"
                outerRadius={72}
                innerRadius={28}
                paddingAngle={2}
              >
                {breakdown.map((entry, index) => (
                  <Cell
                    key={entry.category}
                    fill={CHART_COLORS[index % CHART_COLORS.length]}
                    stroke="transparent"
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number, _name, item) => {
                  const cat = (item.payload as { category?: string })?.category ?? "";
                  return [`${value.toLocaleString()}`, cat];
                }}
              />
              <Legend
                layout="horizontal"
                verticalAlign="bottom"
                wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
