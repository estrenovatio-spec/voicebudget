"use client";

import { Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { getCategoryLabel, getFallbackCategoryId, sortCategoriesByLabel } from "@/lib/categories";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const keywordsFieldClass = cn(
  "flex min-h-[7rem] max-h-52 w-full resize-y overflow-y-auto rounded-md border border-input",
  "bg-background px-3 py-2 text-sm leading-relaxed ring-offset-background",
  "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  "disabled:cursor-not-allowed disabled:opacity-50",
);

function parseKeywordsInput(raw: string): string[] {
  return raw
    .split(/[,\n]+/)
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean);
}
import { useCategories, useStore } from "@/store/useStore";
import type { TxType } from "@/types";

function replaceTokens(template: string, tokens: Record<string, string>): string {
  let s = template;
  for (const [key, value] of Object.entries(tokens)) {
    s = s.split(`{${key}}`).join(value);
  }
  return s;
}

export function CategoryManager() {
  const locale = useStore((s) => s.locale);
  const categories = useCategories();
  const addCategory = useStore((s) => s.addCategory);
  const updateCategory = useStore((s) => s.updateCategory);
  const removeCategory = useStore((s) => s.removeCategory);
  const restoreDefaultCategories = useStore((s) => s.restoreDefaultCategories);
  const { toast } = useToast();

  const [tab, setTab] = useState<TxType>("expense");
  const [newName, setNewName] = useState("");
  const [newKeywords, setNewKeywords] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [editRu, setEditRu] = useState("");
  const [editEn, setEditEn] = useState("");
  const [editKeywords, setEditKeywords] = useState("");

  const list = useMemo(
    () => sortCategoriesByLabel(categories.filter((c) => c.type === tab), categories, locale),
    [categories, tab, locale],
  );

  const handleAdd = () => {
    const name = newName.trim();
    if (!name) return;
    const kw = parseKeywordsInput(newKeywords);
    addCategory(tab, name, name, kw);
    setNewName("");
    setNewKeywords("");
  };

  const startEdit = (id: string) => {
    const cat = categories.find((c) => c.id === id);
    if (!cat) return;
    setPendingDeleteId(null);
    setEditingId(id);
    setEditRu(cat.labels?.ru ?? "");
    setEditEn(cat.labels?.en ?? "");
    setEditKeywords((cat.keywords ?? []).join("\n"));
  };

  const saveEdit = () => {
    if (!editingId) return;
    updateCategory(editingId, {
      labels: { ru: editRu.trim() || editEn.trim(), en: editEn.trim() || editRu.trim() },
      keywords: parseKeywordsInput(editKeywords),
    });
    setEditingId(null);
  };

  const requestDelete = (id: string) => {
    setEditingId(null);
    const cat = categories.find((c) => c.id === id);
    if (!cat) return;
    if (cat.id === getFallbackCategoryId(cat.type)) {
      toast(t(locale, "categoryDeleteBlocked"), "error");
      return;
    }
    setPendingDeleteId(id);
  };

  const confirmDelete = () => {
    if (!pendingDeleteId) return;
    const ok = removeCategory(pendingDeleteId);
    if (!ok) {
      toast(t(locale, "categoryDeleteBlocked"), "error");
      setPendingDeleteId(null);
      return;
    }
    setPendingDeleteId(null);
  };

  const handleRestoreDefaults = () => {
    restoreDefaultCategories();
    setPendingDeleteId(null);
    setEditingId(null);
    toast(t(locale, "categoryRestored"), "success");
  };

  const pendingCat = pendingDeleteId
    ? categories.find((c) => c.id === pendingDeleteId)
    : undefined;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t(locale, "categoriesHint")}</p>
      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v as TxType);
          setPendingDeleteId(null);
          setEditingId(null);
        }}
      >
        <TabsList className="w-full">
          <TabsTrigger value="expense" className="flex-1">
            {t(locale, "filterExpense")}
          </TabsTrigger>
          <TabsTrigger value="income" className="flex-1">
            {t(locale, "filterIncome")}
          </TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-3 space-y-2">
          <ul className="max-h-40 space-y-1 overflow-y-auto">
            {list.map((cat) => {
              const canDelete = cat.id !== getFallbackCategoryId(cat.type);
              const isPending = pendingDeleteId === cat.id;

              return (
                <li
                  key={cat.id}
                  className="flex flex-col gap-1.5 rounded-md border px-2 py-1.5 text-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">
                      {getCategoryLabel(cat.id, categories, locale)}
                      {cat.isSystem && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          ({t(locale, "categorySystem")})
                        </span>
                      )}
                    </span>
                    {!isPending && (
                      <div className="flex shrink-0 gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => startEdit(cat.id)}
                          aria-label={t(locale, "categoryEdit")}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {canDelete && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => requestDelete(cat.id)}
                            aria-label={t(locale, "categoryDelete")}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>

                  {isPending && pendingCat && (
                    <div className="space-y-2 border-t border-destructive/20 pt-2">
                      <p className="text-xs text-muted-foreground">
                        {replaceTokens(t(locale, "categoryDeleteConfirm"), {
                          name: getCategoryLabel(cat.id, categories, locale),
                          fallback: getCategoryLabel(
                            getFallbackCategoryId(cat.type),
                            categories,
                            locale,
                          ),
                        })}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          className="flex-1"
                          onClick={confirmDelete}
                        >
                          {t(locale, "categoryDeleteYes")}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => setPendingDeleteId(null)}
                        >
                          {t(locale, "cancel")}
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          {editingId && (
            <div className="space-y-2 rounded-md border bg-muted/30 p-2">
              <p className="text-xs font-medium">{t(locale, "categoryEdit")}</p>
              <Input
                value={editRu}
                onChange={(e) => setEditRu(e.target.value)}
                placeholder={t(locale, "categoryNameRu")}
              />
              <Input
                value={editEn}
                onChange={(e) => setEditEn(e.target.value)}
                placeholder={t(locale, "categoryNameEn")}
              />
              <textarea
                value={editKeywords}
                onChange={(e) => setEditKeywords(e.target.value)}
                placeholder={t(locale, "categoryKeywords")}
                className={keywordsFieldClass}
                rows={6}
                spellCheck={false}
              />
              <div className="flex gap-2">
                <Button type="button" size="sm" className="flex-1" onClick={saveEdit}>
                  {t(locale, "confirm")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setEditingId(null)}
                >
                  {t(locale, "cancel")}
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-2 border-t pt-3">
            <div className="flex justify-center py-1">
              <span
                className={cn(
                  "inline-flex items-center rounded-full bg-emerald-600 px-5 py-2",
                  "text-sm font-semibold text-white shadow-sm",
                )}
              >
                {t(locale, "categoryAdd")}
              </span>
            </div>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t(locale, "categoryNameRu")}
            />
            <textarea
              value={newKeywords}
              onChange={(e) => setNewKeywords(e.target.value)}
              placeholder={t(locale, "categoryKeywords")}
              className={keywordsFieldClass}
              rows={5}
              spellCheck={false}
            />
            <Button type="button" className="w-full" variant="secondary" onClick={handleAdd}>
              <Plus className="mr-1 h-4 w-4" />
              {t(locale, "categoryAddSubmit")}
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      <Button
        type="button"
        variant="outline"
        className="w-full text-xs"
        onClick={handleRestoreDefaults}
      >
        <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
        {t(locale, "categoryRestoreDefaults")}
      </Button>
    </div>
  );
}
