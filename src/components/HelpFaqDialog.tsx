"use client";

import { CircleHelp } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { HelpFaqChat } from "@/components/HelpFaqChat";
import { faqCheatsheet } from "@/lib/help-faq-content";
import { t } from "@/lib/i18n";
import type { Locale } from "@/types";

type HelpFaqDialogProps = {
  locale: Locale;
  variant?: "settings";
};

export function HelpFaqDialog({ locale, variant = "settings" }: HelpFaqDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant={variant === "settings" ? "secondary" : "outline"}
          className="w-full gap-2"
        >
          <CircleHelp className="h-4 w-4 shrink-0" />
          {t(locale, "helpButton")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-sm overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t(locale, "helpTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-md border bg-muted/40 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t(locale, "helpCheatsheetTitle")}
            </p>
            <ul className="space-y-1 text-sm text-foreground">
              {faqCheatsheet(locale).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
          <HelpFaqChat locale={locale} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
