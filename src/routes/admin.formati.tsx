import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Plus, Pencil, Trash2, Check, X, Image as ImageIcon, BookOpen, Gift } from "lucide-react";
import { toast } from "sonner";

import {
  adminListAllFormats,
  adminUpsertFormat,
  adminDeleteFormat,
} from "@/lib/api/formats.functions";
import { formatKM, CATEGORY_LABEL } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/admin/formati")({
  component: FormatsPage,
});

type Category = "print" | "album" | "gift";
type Editing = {
  id?: string;
  name: string;
  price_km: number;
  description: string;
  active: boolean;
  sort_order: number;
  category: Category;
};

const CAT_ICON: Record<Category, React.ReactNode> = {
  print: <ImageIcon className="h-4 w-4" />,
  album: <BookOpen className="h-4 w-4" />,
  gift: <Gift className="h-4 w-4" />,
};

function FormatsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListAllFormats);
  const upsertFn = useServerFn(adminUpsertFormat);
  const deleteFn = useServerFn(adminDeleteFormat);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "formats"],
    queryFn: () => listFn(),
  });
  const [editing, setEditing] = useState<Editing | null>(null);

  const upsertMut = useMutation({
    mutationFn: (e: Editing) =>
      upsertFn({
        data: {
          id: e.id,
          name: e.name,
          price_km: e.price_km,
          description: e.description || null,
          active: e.active,
          sort_order: e.sort_order,
          category: e.category,
        },
      }),
    onSuccess: () => {
      toast.success("Sačuvano");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["admin", "formats"] });
      qc.invalidateQueries({ queryKey: ["formats"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Greška"),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Obrisano");
      qc.invalidateQueries({ queryKey: ["admin", "formats"] });
      qc.invalidateQueries({ queryKey: ["formats"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Greška pri brisanju"),
  });

  const formats = data?.formats ?? [];
  const grouped = (["print", "album", "gift"] as Category[]).map((cat) => ({
    cat,
    items: formats.filter((f: any) => (f.category ?? "print") === cat),
  }));

  return (
    <div className="p-6 sm:p-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Proizvodi i cijene</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Formati štampe, foto albumi i pokloni.
          </p>
        </div>
        <Button
          onClick={() =>
            setEditing({
              name: "",
              price_km: 0.5,
              description: "",
              active: true,
              sort_order: formats.length + 1,
              category: "print",
            })
          }
          className="rounded-full"
        >
          <Plus className="mr-1.5 h-4 w-4" />
          Novi proizvod
        </Button>
      </div>

      {isLoading ? (
        <div className="mt-6 rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          Učitavanje...
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {grouped.map(({ cat, items }) => (
            <div key={cat}>
              <div className="mb-3 flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-primary">
                  {CAT_ICON[cat]}
                </span>
                <h2 className="text-sm font-semibold tracking-tight">
                  {CATEGORY_LABEL[cat]}
                </h2>
                <span className="text-xs text-muted-foreground">({items.length})</span>
              </div>
              <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-soft)]">
                {items.length === 0 ? (
                  <div className="p-6 text-center text-xs text-muted-foreground">
                    Nema stavki u ovoj kategoriji
                  </div>
                ) : (
                  <ul className="divide-y divide-border">
                    {items.map((f: any) => (
                      <li
                        key={f.id}
                        className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{f.name}</span>
                            {!f.active && (
                              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                                Neaktivno
                              </span>
                            )}
                          </div>
                          {f.description && (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {f.description}
                            </p>
                          )}
                        </div>
                        <div className="text-right font-semibold tabular-nums">
                          {formatKM(Number(f.price_km))}
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() =>
                              setEditing({
                                id: f.id,
                                name: f.name,
                                price_km: Number(f.price_km),
                                description: f.description ?? "",
                                active: f.active,
                                sort_order: f.sort_order,
                                category: (f.category ?? "print") as Category,
                              })
                            }
                            className="grid h-8 w-8 place-items-center rounded-full hover:bg-accent"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Obrisati "${f.name}"?`))
                                deleteMut.mutate(f.id);
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
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4 backdrop-blur-sm"
          onClick={() => setEditing(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-elevated)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold">
              {editing.id ? "Uredi proizvod" : "Novi proizvod"}
            </h3>
            <div className="mt-5 space-y-4">
              <div>
                <Label>Kategorija</Label>
                <Select
                  value={editing.category}
                  onValueChange={(v: Category) => setEditing({ ...editing, category: v })}
                >
                  <SelectTrigger className="mt-1.5 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="print">{CATEGORY_LABEL.print}</SelectItem>
                    <SelectItem value="album">{CATEGORY_LABEL.album}</SelectItem>
                    <SelectItem value="gift">{CATEGORY_LABEL.gift}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Naziv</Label>
                <Input
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className="mt-1.5"
                  placeholder="10x15 cm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Cijena (KM)</Label>
                  <Input
                    type="number"
                    step="0.05"
                    min="0"
                    value={editing.price_km}
                    onChange={(e) =>
                      setEditing({ ...editing, price_km: Number(e.target.value) })
                    }
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label>Redoslijed</Label>
                  <Input
                    type="number"
                    min="0"
                    value={editing.sort_order}
                    onChange={(e) =>
                      setEditing({ ...editing, sort_order: Number(e.target.value) })
                    }
                    className="mt-1.5"
                  />
                </div>
              </div>
              <div>
                <Label>Opis</Label>
                <Input
                  value={editing.description}
                  onChange={(e) =>
                    setEditing({ ...editing, description: e.target.value })
                  }
                  className="mt-1.5"
                  placeholder="Opcionalno"
                />
              </div>
              <div className="flex items-center justify-between rounded-xl bg-secondary px-4 py-3">
                <Label className="cursor-pointer">Aktivno</Label>
                <Switch
                  checked={editing.active}
                  onCheckedChange={(v) => setEditing({ ...editing, active: v })}
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
                disabled={!editing.name || upsertMut.isPending}
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
