import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Plus, Pencil, Trash2, Check, X, Receipt } from "lucide-react";
import { toast } from "sonner";

import {
  adminListExpenses,
  adminUpsertExpense,
  adminDeleteExpense,
} from "@/lib/api/formats.functions";
import { formatKM } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/admin/expenses")({
  component: ExpensesPage,
});

const CATEGORIES = [
  { value: "materials", label: "Materijali" },
  { value: "shipping", label: "Dostava" },
  { value: "equipment", label: "Oprema" },
  { value: "marketing", label: "Marketing" },
  { value: "rent", label: "Najam" },
  { value: "utilities", label: "Režije" },
  { value: "other", label: "Ostalo" },
];

type Editing = {
  id?: string;
  name: string;
  amount_km: number;
  category: string;
  occurred_at: string;
  notes: string;
};

function ExpensesPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListExpenses);
  const upsertFn = useServerFn(adminUpsertExpense);
  const deleteFn = useServerFn(adminDeleteExpense);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "expenses"],
    queryFn: () => listFn(),
  });
  const [editing, setEditing] = useState<Editing | null>(null);

  const upsertMut = useMutation({
    mutationFn: (e: Editing) =>
      upsertFn({
        data: {
          id: e.id,
          name: e.name,
          amount_km: e.amount_km,
          category: e.category,
          occurred_at: e.occurred_at,
          notes: e.notes || null,
        },
      }),
    onSuccess: () => {
      toast.success("Sačuvano");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["admin", "expenses"] });
      qc.invalidateQueries({ queryKey: ["admin", "stats"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Obrisano");
      qc.invalidateQueries({ queryKey: ["admin", "expenses"] });
      qc.invalidateQueries({ queryKey: ["admin", "stats"] });
    },
  });

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="p-6 sm:p-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Troškovi</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Praćenje poslovnih troškova.
          </p>
        </div>
        <Button
          onClick={() =>
            setEditing({
              name: "",
              amount_km: 0,
              category: "materials",
              occurred_at: today,
              notes: "",
            })
          }
          className="rounded-full"
        >
          <Plus className="mr-1.5 h-4 w-4" />
          Novi trošak
        </Button>
      </div>

      <div className="mt-6 rounded-2xl bg-gradient-to-br from-destructive/5 to-warning/5 p-5">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
          <Receipt className="h-3.5 w-3.5" /> Ukupno troškova
        </div>
        <div className="mt-1 text-3xl font-semibold tabular-nums">
          {formatKM(data?.total ?? 0)}
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-soft)]">
        {isLoading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Učitavanje...
          </div>
        ) : !data?.expenses.length ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Još nema troškova.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {data.expenses.map((e: any) => (
              <li
                key={e.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{e.name}</span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                      {CATEGORIES.find((c) => c.value === e.category)?.label ?? e.category}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {new Date(e.occurred_at).toLocaleDateString("bs-BA")}
                    {e.notes ? ` · ${e.notes}` : ""}
                  </div>
                </div>
                <div className="text-right font-semibold tabular-nums">
                  {formatKM(Number(e.amount_km))}
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() =>
                      setEditing({
                        id: e.id,
                        name: e.name,
                        amount_km: Number(e.amount_km),
                        category: e.category,
                        occurred_at: String(e.occurred_at).slice(0, 10),
                        notes: e.notes ?? "",
                      })
                    }
                    className="grid h-8 w-8 place-items-center rounded-full hover:bg-accent"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Obrisati "${e.name}"?`)) deleteMut.mutate(e.id);
                    }}
                    className="grid h-8 w-8 place-items-center rounded-full text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {editing && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4 backdrop-blur-sm"
          onClick={() => setEditing(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-elevated)]"
            onClick={(ev) => ev.stopPropagation()}
          >
            <h3 className="text-lg font-semibold">
              {editing.id ? "Uredi trošak" : "Novi trošak"}
            </h3>
            <div className="mt-5 space-y-4">
              <div>
                <Label>Naziv</Label>
                <Input
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className="mt-1.5"
                  placeholder="Foto papir, kartoni..."
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Iznos (KM)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editing.amount_km}
                    onChange={(e) =>
                      setEditing({ ...editing, amount_km: Number(e.target.value) })
                    }
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label>Datum</Label>
                  <Input
                    type="date"
                    value={editing.occurred_at}
                    onChange={(e) =>
                      setEditing({ ...editing, occurred_at: e.target.value })
                    }
                    className="mt-1.5"
                  />
                </div>
              </div>
              <div>
                <Label>Kategorija</Label>
                <Select
                  value={editing.category}
                  onValueChange={(v) => setEditing({ ...editing, category: v })}
                >
                  <SelectTrigger className="mt-1.5 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Napomena</Label>
                <Textarea
                  rows={2}
                  value={editing.notes}
                  onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                  className="mt-1.5"
                  placeholder="Opcionalno"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setEditing(null)}
                className="rounded-full"
              >
                <X className="mr-1.5 h-4 w-4" /> Otkaži
              </Button>
              <Button
                onClick={() => upsertMut.mutate(editing)}
                disabled={!editing.name || editing.amount_km <= 0 || upsertMut.isPending}
                className="rounded-full"
              >
                <Check className="mr-1.5 h-4 w-4" /> Sačuvaj
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
