import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Download, Trash2, FileImage, Zap } from "lucide-react";
import { toast } from "sonner";
import JSZip from "jszip";

import {
  adminGetOrder,
  adminUpdateOrderStatus,
  adminDeleteImage,
} from "@/lib/api/orders.functions";
import { formatKM, formatOrderNo } from "@/lib/format";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { STATUS_LABEL, STATUS_ORDER, STATUS_STYLES } from "@/components/order-status";

export const Route = createFileRoute("/admin/orders/$id")({
  component: OrderDetail,
});

function OrderDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const getFn = useServerFn(adminGetOrder);
  const statusFn = useServerFn(adminUpdateOrderStatus);
  const deleteImgFn = useServerFn(adminDeleteImage);

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

  if (isLoading) {
    return <div className="p-10 text-sm text-muted-foreground">Učitavanje...</div>;
  }
  if (error || !data) {
    return (
      <div className="p-10">
        <Link to="/admin/orders" className="text-sm text-muted-foreground hover:text-foreground">
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
        to="/admin/orders"
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
                <Zap className="h-3 w-3" /> Same day
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

          <Section title="Stavke narudžbe">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="py-2">Format / Proizvod</th>
                    <th className="py-2">Cijena</th>
                    <th className="py-2">Kopije</th>
                    <th className="py-2 text-right">Ukupno</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((it: any) => (
                    <tr key={it.id}>
                      <td className="py-2.5">
                        <div>{it.format_name}</div>
                        {it.notes && (
                          <div className="mt-1 rounded-md bg-warning/10 px-2 py-1 text-xs text-warning-foreground">
                            📝 {it.notes}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 tabular-nums">
                        {formatKM(Number(it.price_per_unit))}
                      </td>
                      <td className="py-2.5 tabular-nums font-medium">{it.quantity}</td>
                      <td className="py-2.5 text-right font-medium tabular-nums">
                        {formatKM(Number(it.total_price))}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="text-sm">
                  <tr>
                    <td colSpan={3} className="pt-4 text-right text-muted-foreground">
                      Međuzbir
                    </td>
                    <td className="pt-4 text-right tabular-nums">{formatKM(subtotal)}</td>
                  </tr>
                  <tr>
                    <td colSpan={3} className="text-right text-muted-foreground">
                      Dostava
                    </td>
                    <td className="text-right tabular-nums">
                      {Number(order.shipping_fee) === 0
                        ? "Besplatno"
                        : formatKM(Number(order.shipping_fee))}
                    </td>
                  </tr>
                  {Number(order.same_day_fee) > 0 && (
                    <tr>
                      <td colSpan={3} className="text-right text-muted-foreground">
                        Same day print
                      </td>
                      <td className="text-right tabular-nums">
                        {formatKM(Number(order.same_day_fee))}
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td colSpan={3} className="pt-2 text-right text-base font-medium">
                      Ukupno
                    </td>
                    <td className="pt-2 text-right text-lg font-semibold tabular-nums">
                      {formatKM(Number(order.total_price))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Section>
        </div>

        <aside className="space-y-4">
          <Section title="Dostava">
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
