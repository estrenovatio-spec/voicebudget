"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCategoryLabel } from "@/lib/categories";
import { t } from "@/lib/i18n";
import { useCategories, useStore } from "@/store/useStore";
import type { TxType } from "@/types";

export function CategoryManager() {
  const locale = useStore((s) => s.locale);
  const categories = useCategories();
  const addCategory = useStore((s) => s.addCategory);
  const updateCategory = useStore((s) => s.updateCategory);
  const removeCategory = useStore((s) => s.removeCategory);

  const [tab, setTab] = useState<TxType>("expense");
  const [newName, setNewName] = useState("");
  const [newKeywords, setNewKeywords] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRu, setEditRu] = useState("");
  const [editEn, setEditEn] = useState("");
  const [editKeywords, setEditKeywords] = useState("");

  const list = categories.filter((c) => c.type === tab);

  const handleAdd = () => {
    const name = newName.trim();
    if (!name) return;
    const kw = newKeywords
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);
    addCategory(tab, name, name, kw);
    setNewName("");
    setNewKeywords("");
  };

  const startEdit = (id: string) => {
    const cat = categories.find((c) => c.id === id);
    if (!cat) return;
    setEditingId(id);
    setEditRu(cat.labels?.ru ?? "");
    setEditEn(cat.labels?.en ?? "");
    setEditKeywords((cat.keywords ?? []).join(", "));
  };

  const saveEdit = () => {
    if (!editingId) return;
    updateCategory(editingId, {
      labels: { ru: editRu.trim() || editEn.trim(), en: editEn.trim() || editRu.trim() },
      keywords: editKeywords
        .split(",")
        .map((k) => k.trim().toLowerCase())
        .filter(Boolean),
    });
    setEditingId(null);
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t(locale, "categoriesHint")}</p>
      <Tabs value={tab} onValueChange={(v) => setTab(v as TxType)}>
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
            {list.map((cat) => (
              <li
                key={cat.id}
                className="flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-sm"
              >
                <span className="truncate font-medium">
                  {getCategoryLabel(cat.id, categories, locale)}
                  {cat.isSystem && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      ({t(locale, "categorySystem")})
                    </span>
                  )}
                </span>
                <div className="flex shrink-0 gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => startEdit(cat.id)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  {!cat.isSystem && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => removeCategory(cat.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
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
              <Input
                value={editKeywords}
                onChange={(e) => setEditKeywords(e.target.value)}
                placeholder={t(locale, "categoryKeywords")}
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

          <div className="space-y-2 border-t pt-2">
            <p className="text-xs font-medium">{t(locale, "categoryAdd")}</p>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t(locale, "categoryNameRu")}
            />
            <Input
              value={newKeywords}
              onChange={(e) => setNewKeywords(e.target.value)}
              placeholder={t(locale, "categoryKeywords")}
            />
            <Button type="button" className="w-full" variant="secondary" onClick={handleAdd}>
              <Plus className="mr-1 h-4 w-4" />
              {t(locale, "categoryAdd")}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
