"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { openExternalAppLink } from "@/lib/education-links";
import { t } from "@/lib/i18n";
import { useToast } from "@/components/ui/toast";
import { useStore } from "@/store/useStore";

export function MoreServiceForm({
  title,
  subtitle,
  externalFormUrl,
}: {
  title: string;
  subtitle?: string;
  externalFormUrl?: string | null;
}) {
  const locale = useStore((s) => s.locale);
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState(false);

  if (externalFormUrl) {
    return (
      <div className="space-y-3">
        {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
        <Button type="button" className="w-full" onClick={() => openExternalAppLink(externalFormUrl)}>
          {t(locale, "moreServiceOpenForm")}
        </Button>
      </div>
    );
  }

  const submit = () => {
    const n = name.trim();
    const p = phone.trim();
    if (!n || !p) {
      toast(t(locale, "moreServiceFormRequired"), "error");
      return;
    }
    setSent(true);
    toast(t(locale, "moreServiceFormDone"), "success");
  };

  if (sent) {
    return (
      <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-4 text-sm text-emerald-950 dark:text-emerald-50">
        {t(locale, "moreServiceFormDone")}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">{title}</p>
      {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t(locale, "moreServiceFormName")}
      />
      <Input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder={t(locale, "moreServiceFormPhone")}
        inputMode="tel"
      />
      <Button type="button" className="w-full" onClick={submit}>
        {t(locale, "moreServiceFormSubmit")}
      </Button>
    </div>
  );
}
