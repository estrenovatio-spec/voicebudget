"use client";

import { useEffect, useState } from "react";

const STORAGE_PREFIX = "voicebudget-hints-hidden:";

type DismissibleHintsProps = {
  /** Ключ зоны — сохраняется между открытиями приложения */
  zoneId: string;
  lines: string[];
  className?: string;
};

function readHidden(zoneId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(STORAGE_PREFIX + zoneId) === "1";
  } catch {
    return false;
  }
}

function writeHidden(zoneId: string, hidden: boolean): void {
  if (typeof window === "undefined") return;
  try {
    const key = STORAGE_PREFIX + zoneId;
    if (hidden) localStorage.setItem(key, "1");
    else localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/**
 * Подсказки: нажал — скрылись (запоминается в localStorage).
 * Нажал в той же зоне — снова видны.
 */
export function DismissibleHints({ zoneId, lines, className = "" }: DismissibleHintsProps) {
  const [visible, setVisible] = useState<boolean | null>(null);

  useEffect(() => {
    setVisible(!readHidden(zoneId));
  }, [zoneId]);

  const hide = () => {
    writeHidden(zoneId, true);
    setVisible(false);
  };

  const show = () => {
    writeHidden(zoneId, false);
    setVisible(true);
  };

  if (visible === null) {
    return <div className={`min-h-[1.25rem] w-full ${className}`} aria-hidden />;
  }

  if (!visible) {
    return (
      <button
        type="button"
        aria-label={`${zoneId}-hints`}
        className={`block min-h-[1.25rem] w-full touch-manipulation ${className}`}
        onClick={show}
      />
    );
  }

  return (
    <div className={`space-y-1 ${className}`}>
      {lines.map((line) => (
        <button
          key={line}
          type="button"
          onClick={hide}
          className="block w-full touch-manipulation rounded-md px-1 py-0.5 text-center text-xs text-muted-foreground transition-colors hover:bg-muted/50 active:bg-muted"
        >
          {line}
        </button>
      ))}
    </div>
  );
}
