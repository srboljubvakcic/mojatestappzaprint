import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Download, Trash2, FileImage, Zap, Pencil, Save, X } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import JSZip from "jszip";

import {
  adminGetOrder,
  adminUpdateOrderStatus,
  adminDeleteImage,
  adminUpdateOrder,
} from "@/lib/api/orders.functions";
import { formatKM, formatOrderNo } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { STATUS_LABEL, STATUS_ORDER, STATUS_STYLES } from "@/components/order-status";

export const Route = createFileRoute("/panel/porudzbine/$id")({
  component: OrderDetail,
});

function OrderDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const getFn = useServerFn(adminGetOrder);
  const statusFn = useServerFn(adminUpdateOrderStatus);
  const deleteImgFn = useServerFn(adminDeleteImage);
  const updateFn = useServerFn(adminUpdateOrder);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    postal_code: "",
    notes: "",
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "order", id],
    queryFn: () => getFn({ data: { id } }),
  });

  const statusMut = useMutation({
    mutationFn: (status: string) =>
      statusFn({ data: { id, status: status as any } }),
    onSuccess: () => {
      toast.success("Status ažuriran");
      qc.invalidateQueries({ queryKey: ["admin", "order", id] });
      qc.invalidateQueries({ queryKey: ["admin", "orders"] });
      qc.invalidateQueries({ queryKey: ["admin", "stats"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteImgMut = useMutation({
    mutationFn: (imgId: string) => deleteImgFn({ data: { id: imgId } }),
    onSuccess: () => {
      toast.success("Slika obrisana");
      qc.invalidateQueries({ queryKey: ["admin", "order", id] });
    },
  });

  const updateMut = useMutation({
    mutationFn: () => updateFn({ data: { id, ...form } }),
    onSuccess: () => {
      toast.success("Podaci ažurirani");
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["admin", "order", id] });
      qc.invalidateQueries({ queryKey: ["admin", "orders"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  useEffect(() => {
    if (data?.order && !editing) {
      setForm({
        full_name: data.order.full_name ?? "",
        phone: data.order.phone ?? "",
        email: data.order.email ?? "",
        address: data.order.address ?? "",
        city: data.order.city ?? "",
        postal_code: data.order.postal_code ?? "",
        notes: data.order.notes ?? "",
      });
    }
  }, [data?.order, editing]);

  if (isLoading) {
    return <div className="p-10 text-sm text-muted-foreground">Učitavanje...</div>;
  }
  if (error || !data) {
    return (
      <div className="p-10">
        <Link to="/panel/porudzbine" className="text-sm text-muted-foreground hover:text-foreground">
          ← Sve narudžbe
        </Link>
        <div className="mt-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
          Greška pri učitavanju narudžbe: {(error as any)?.message ?? "nepoznata greška"}
        </div>
      </div>
    );
  }
  const { order, items, images, signedUrls } = data;
  const subtotal = items.reduce((s: number, it: any) => s + Number(it.total_price), 0);

  const downloadAll = async () => {
    const active = images.filter((i: any) => i.status === "active");
    if (!active.length) return toast.info("Nema aktivnih slika za preuzimanje");
    toast.loading("Pripremam ZIP...", { id: "zip" });
    try {
      const zip = new JSZip();
      await Promise.all(
        active.map(async (img: any) => {
          const url = signedUrls[img.storage_path];
          if (!url) return;
          const blob = await fetch(url).then((r) => r.blob());
          const name = img.storage_path.split("/").pop() ?? "image.jpg";
          zip.file(name, blob);
        }),
      );
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `narudzba-${formatOrderNo(order.order_number).replace("#", "")}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("ZIP preuzet", { id: "zip" });
    } catch (e: any) {
      toast.error(e.message, { id: "zip" });
    }
  };

  return (
    <div className="p-6 sm:p-10">
      <Link
        to="/panel/porudzbine"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Sve narudžbe
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight tabular-nums">
              {formatOrderNo(order.order_number)}
            </h1>
            {order.same_day && (
              <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2.5 py-1 text-xs font-medium text-warning-foreground">
                <Zap className="h-3 w-3" /> Istog dana
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {new Date(order.created_at).toLocaleString("bs-BA")}
          </p>
        </div>
      </div>

      {/* Status tabs */}
      <div className="mt-5 flex flex-wrap gap-1.5 rounded-2xl border border-border bg-card p-1.5 shadow-[var(--shadow-soft)]">
        {STATUS_ORDER.map((s) => {
          const active = order.status === s;
          return (
            <button
              key={s}
              type="button"
              disabled={statusMut.isPending}
              onClick={() => !active && statusMut.mutate(s)}
              className={
                active
                  ? `rounded-xl px-3.5 py-1.5 text-xs font-semibold ${STATUS_STYLES[s]}`
                  : "rounded-xl px-3.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
              }
            >
              {STATUS_LABEL[s]}
            </button>
          );
        })}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Section
            title={`Slike narudžbe (${images.length})`}
            actions={
              <Button
                variant="outline"
                size="sm"
                onClick={downloadAll}
                className="rounded-full"
                disabled={!images.some((i: any) => i.status === "active")}
              >
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Preuzmi sve (ZIP)
              </Button>
            }
          >
            {!images.length ? (
              <p className="text-sm text-muted-foreground">Nema slika.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {images.map((img: any) => {
                  const url = signedUrls[img.storage_path];
                  const isDeleted = img.status === "deleted";
                  return (
                    <div
                      key={img.id}
                      className="group relative overflow-hidden rounded-xl border border-border bg-muted"
                    >
                      <div className="aspect-square">
                        {isDeleted || !url ? (
                          <div className="grid h-full place-items-center text-xs text-muted-foreground">
                            <div className="text-center">
                              <FileImage className="mx-auto h-6 w-6" />
                              <p className="mt-1">
                                {isDeleted ? "Obrisana" : "Nedostupno"}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <a href={url} target="_blank" rel="noopener noreferrer">
                            <img src={url} alt="" className="h-full w-full object-cover" />
                          </a>
                        )}
                      </div>
                      {!isDeleted && url && (
                        <div className="absolute inset-x-0 bottom-0 flex translate-y-full items-center justify-between gap-1 bg-gradient-to-t from-black/70 to-transparent p-2 transition-transform group-hover:translate-y-0">
                          <a
                            href={url}
                            download
                            className="rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-white"
                          >
                            <Download className="inline h-3 w-3" />
                          </a>
                          <button
                            onClick={() => {
                              if (confirm("Obrisati ovu sliku?"))
                                deleteImgMut.mutate(img.id);
                            }}
                            className="rounded-full bg-destructive/95 px-2.5 py-1 text-[11px] font-medium text-destructive-foreground hover:bg-destructive"
                          >
                            <Trash2 className="inline h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Section>

          <Section title={`Plan štampanja (${items.length})`}>
            <ul className="divide-y divide-border">
              {items.map((it: any) => {
                const path = it.images?.storage_path;
                const url = path ? signedUrls[path] : null;
                const isDeleted = it.images?.status === "deleted";
                return (
                  <li key={it.id} className="flex items-center gap-4 py-3">
                    <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-muted">
                      {url ? (
                        <a href={url} target="_blank" rel="noopener noreferrer" className="block h-full w-full">
                          <img src={url} alt="" className="h-full w-full object-cover" />
                        </a>
                      ) : (
                        <FileImage className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{it.format_name}</span>
                        {isDeleted && (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase text-muted-foreground">
                            slika obrisana
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                        {formatKM(Number(it.price_per_unit))} × {it.quantity} kopija
                      </div>
                      {it.notes && (
                        <div className="mt-1.5 inline-block rounded-md bg-warning/10 px-2 py-1 text-xs text-warning-foreground">
                          📝 {it.notes}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="grid h-9 min-w-[44px] place-items-center rounded-full bg-primary/10 px-3 text-sm font-bold tabular-nums text-primary">
                        ×{it.quantity}
                      </div>
                      <div className="mt-1 text-sm font-semibold tabular-nums">
                        {formatKM(Number(it.total_price))}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <dl className="mt-5 space-y-1.5 border-t border-border pt-4 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <dt>Međuzbir</dt>
                <dd className="tabular-nums">{formatKM(subtotal)}</dd>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <dt>Dostava</dt>
                <dd className="tabular-nums">
                  {Number(order.shipping_fee) === 0
                    ? "Besplatno"
                    : formatKM(Number(order.shipping_fee))}
                </dd>
              </div>
              {Number(order.same_day_fee) > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <dt>Štampa istog dana</dt>
                  <dd className="tabular-nums">{formatKM(Number(order.same_day_fee))}</dd>
                </div>
              )}
              {Number(order.gift_packaging_fee) > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <dt>Poklon pakovanje</dt>
                  <dd className="tabular-nums">{formatKM(Number(order.gift_packaging_fee))}</dd>
                </div>
              )}
              {Number(order.gift_message_fee) > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <dt>Poklon poruka</dt>
                  <dd className="tabular-nums">{formatKM(Number(order.gift_message_fee))}</dd>
                </div>
              )}
              {order.gift_message && (
                <div className="mt-2 rounded-xl border border-primary/20 bg-primary/5 p-3">
                  <div className="text-xs font-semibold text-primary">Poklon poruka</div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{order.gift_message}</p>
                </div>
              )}
              <div className="flex items-baseline justify-between pt-2">
                <dt className="text-base font-medium">Ukupno</dt>
                <dd className="text-lg font-semibold tabular-nums">
                  {formatKM(Number(order.total_price))}
                </dd>
              </div>
            </dl>
          </Section>
        </div>

        <aside className="space-y-4">
          <Section
            title="Dostava"
            actions={
              editing ? (
                <div className="flex gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => setEditing(false)}
                  >
                    <X className="mr-1 h-3 w-3" /> Otkaži
                  </Button>
                  <Button
                    size="sm"
                    className="rounded-full"
                    disabled={updateMut.isPending}
                    onClick={() => updateMut.mutate()}
                  >
                    <Save className="mr-1 h-3 w-3" /> Sačuvaj
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => setEditing(true)}
                >
                  <Pencil className="mr-1 h-3 w-3" /> Izmijeni
                </Button>
              )
            }
          >
            {editing ? (
              <div className="space-y-3 text-sm">
                <EditField label="Ime" value={form.full_name} onChange={(v) => setForm({ ...form, full_name: v })} />
                <EditField label="Telefon" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
                <EditField label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
                <EditField label="Adresa" value={form.address} onChange={(v) => setForm({ ...form, address: v })} />
                <EditField label="Grad" value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
                <EditField label="Pošt. broj" value={form.postal_code} onChange={(v) => setForm({ ...form, postal_code: v })} />
                <div>
                  <Label className="text-xs text-muted-foreground">Napomena</Label>
                  <Textarea
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="mt-1 min-h-[70px] rounded-xl text-sm"
                  />
                </div>
              </div>
            ) : (
              <dl className="space-y-2 text-sm">
                <Field label="Ime" value={order.full_name} />
                <Field label="Telefon" value={order.phone} />
                <Field label="Email" value={order.email || "—"} />
                <Field label="Adresa" value={order.address} />
                <Field label="Grad" value={order.city} />
                <Field label="Pošt. broj" value={order.postal_code || "—"} />
                {order.notes && <Field label="Napomena" value={order.notes} />}
                {order.shipped_at && (
                  <Field
                    label="Poslato"
                    value={new Date(order.shipped_at).toLocaleString("bs-BA")}
                  />
                )}
              </dl>
            )}
          </Section>
        </aside>
      </div>
    </div>
  );
}

function Section({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h2>
        {actions}
      </div>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}

function EditField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 h-9 rounded-xl text-sm"
      />
    </div>
  );
}
