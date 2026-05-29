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
        <HelpFaqChat locale={locale} />
      </DialogContent>
    </Dialog>
  );
}
