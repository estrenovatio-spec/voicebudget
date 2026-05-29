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
import { FAQ_SECTIONS, faqCheatsheet } from "@/lib/help-faq-content";
import { t } from "@/lib/i18n";
import type { Locale } from "@/types";

function FaqBody({ lines }: { lines: string[] }) {
  const bullets = lines.filter((l) => l.startsWith("• "));
  const paragraphs = lines.filter((l) => !l.startsWith("• "));

  return (
    <div className="space-y-2 text-sm text-muted-foreground">
      {paragraphs.map((p) => (
        <p key={p}>{p}</p>
      ))}
      {bullets.length > 0 ? (
        <ul className="list-disc space-y-1 pl-4">
          {bullets.map((b) => (
            <li key={b}>{b.slice(2)}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

type HelpFaqDialogProps = {
  locale: Locale;
  /** Full-width button at top of settings */
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
        <div className="space-y-2">
          <div className="rounded-md border bg-muted/40 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t(locale, "helpCheatsheetTitle")}
            </p>
            <ul className="space-y-1 text-sm">
              {faqCheatsheet(locale).map((line) => (
                <li key={line} className="text-foreground">
                  {line}
                </li>
              ))}
            </ul>
          </div>
          <HelpFaqChat locale={locale} />
          {FAQ_SECTIONS.map((section) => (
            <details
              key={section.id}
              className="group rounded-md border px-3 py-2 open:bg-muted/30"
            >
              <summary className="cursor-pointer list-none text-sm font-medium marker:content-none [&::-webkit-details-marker]:hidden">
                <span className="flex items-center justify-between gap-2">
                  {section.title[locale]}
                  <span className="text-xs text-muted-foreground group-open:rotate-180">▼</span>
                </span>
              </summary>
              <div className="mt-2 border-t pt-2">
                <FaqBody lines={section.body[locale]} />
              </div>
            </details>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
