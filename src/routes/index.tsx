import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Upload,
  ImagePlus,
  Trash2,
  Plus,
  Minus,
  ShieldCheck,
  Truck,
  Sparkles,
  Loader2,
} from "lucide-react";

import { listActiveFormats } from "@/lib/api/formats.functions";
import {
  createSignedUploads,
  submitOrder,
} from "@/lib/api/orders.functions";
import { supabase } from "@/integrations/supabase/client";
import { formatKM } from "@/lib/format";
import { Button } from "@/components/ui/button";
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
import { SiteHeader, SiteFooter } from "@/components/site-chrome";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FotoPrint BiH — Štampajte fotografije online" },
      {
        name: "description",
        content:
          "Otpremite svoje fotografije, izaberite format i dobijte štampane fotografije na kućnu adresu. Brza dostava u cijeloj Bosni i Hercegovini.",
      },
    ],
  }),
  component: HomePage,
});

type UploadedImage = {
  id: string; // local
  previewUrl: string;
  storagePath: string | null;
  fileName: string;
  uploading: boolean;
  formatId: string;
  quantity: number;
};

function HomePage() {
  const navigate = useNavigate();
  const orderRef = useRef(crypto.randomUUID());
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [customer, setCustomer] = useState({
    full_name: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    postal_code: "",
    notes: "",
  });

  const formatsQuery = useQuery({
    queryKey: ["formats"],
    queryFn: () => listActiveFormats(),
  });
  const formats = formatsQuery.data?.formats ?? [];
  const defaultFormatId = formats[0]?.id ?? "";

  const createSignedUploadsFn = useServerFn(createSignedUploads);
  const submitOrderFn = useServerFn(submitOrder);

  const onDrop = useCallback(
    async (accepted: File[]) => {
      if (!accepted.length) return;
      if (!defaultFormatId) {
        toast.error("Formati još nisu učitani. Pokušajte ponovo za par sekundi.");
        return;
      }
      // create local entries first
      const locals: UploadedImage[] = accepted.map((f) => ({
        id: crypto.randomUUID(),
        previewUrl: URL.createObjectURL(f),
        storagePath: null,
        fileName: f.name,
        uploading: true,
        formatId: defaultFormatId,
        quantity: 1,
      }));
      setImages((prev) => [...prev, ...locals]);

      try {
        const { uploads } = await createSignedUploadsFn({
          data: {
            orderRef: orderRef.current,
            files: accepted.map((f) => ({ name: f.name, size: f.size })),
          },
        });

        await Promise.all(
          accepted.map(async (file, idx) => {
            const local = locals[idx];
            const u = uploads[idx];
            const { error } = await supabase.storage
              .from("order-images")
              .uploadToSignedUrl(u.path, u.token, file, {
                contentType: file.type || "image/jpeg",
                upsert: false,
              });
            setImages((prev) =>
              prev.map((img) =>
                img.id === local.id
                  ? {
                      ...img,
                      uploading: false,
                      storagePath: error ? null : u.path,
                    }
                  : img,
              ),
            );
            if (error) {
              toast.error(`Greška kod otpremanja: ${file.name}`);
            }
          }),
        );
      } catch (e: any) {
        toast.error(e?.message ?? "Greška kod otpremanja");
        setImages((prev) => prev.filter((i) => !locals.find((l) => l.id === i.id)));
      }
    },
    [createSignedUploadsFn, defaultFormatId],
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: { "image/*": [] },
    maxSize: 25 * 1024 * 1024,
    noClick: true,
    noKeyboard: true,
  });

  const updateImg = (id: string, patch: Partial<UploadedImage>) => {
    setImages((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  };
  const removeImg = (id: string) => {
    setImages((prev) => prev.filter((i) => i.id !== id));
  };

  const total = useMemo(() => {
    let sum = 0;
    let qty = 0;
    for (const img of images) {
      const f = formats.find((f) => f.id === img.formatId);
      if (!f) continue;
      sum += Number(f.price_km) * img.quantity;
      qty += img.quantity;
    }
    return { sum, qty };
  }, [images, formats]);

  const canSubmit =
    images.length > 0 &&
    images.every((i) => !i.uploading && i.storagePath) &&
    customer.full_name.trim().length >= 2 &&
    customer.phone.trim().length >= 5 &&
    customer.address.trim().length >= 3 &&
    customer.city.trim().length >= 2 &&
    !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const { orderId } = await submitOrderFn({
        data: {
          orderRef: orderRef.current,
          customer,
          items: images.map((i) => ({
            storage_path: i.storagePath!,
            format_id: i.formatId,
            quantity: i.quantity,
          })),
        },
      });
      toast.success("Narudžba je uspješno poslana!");
      navigate({
        to: "/order/$id",
        params: { id: orderId },
        search: { total: total.sum },
      });
    } catch (e: any) {
      toast.error(e?.message ?? "Greška kod slanja narudžbe");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pt-12 pb-8 sm:px-6 sm:pt-20">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="h-3 w-3" /> Profesionalni kvalitet · Dostava u BiH
          </span>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-6xl">
            Štampajte fotografije
            <br />
            <span className="text-muted-foreground">jednostavno i brzo.</span>
          </h1>
          <p className="mt-5 text-base text-muted-foreground sm:text-lg">
            Otpremite slike, izaberite format i broj kopija. Mi ih štampamo i
            dostavljamo na vašu adresu.
          </p>
        </div>

        <div className="mx-auto mt-8 flex max-w-xl flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground sm:text-sm">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5">
            <ShieldCheck className="h-3.5 w-3.5" /> Sigurno otpremanje
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5">
            <Truck className="h-3.5 w-3.5" /> Dostava u cijeloj BiH
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5">
            Plaćanje pouzećem
          </span>
        </div>
      </section>

      {/* Upload area */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6">
        <div
          {...getRootProps()}
          className={`group relative overflow-hidden rounded-3xl border-2 border-dashed bg-card p-10 text-center transition-all sm:p-16 ${
            isDragActive
              ? "border-primary bg-accent"
              : "border-border hover:border-primary/60 hover:bg-accent/40"
          }`}
        >
          <input {...getInputProps()} />
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Upload className="h-7 w-7" />
          </div>
          <h2 className="mt-5 text-xl font-semibold sm:text-2xl">
            Prevucite fotografije ovdje
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            ili kliknite dugme ispod · JPG, PNG, HEIC do 25MB
          </p>
          <Button
            type="button"
            onClick={open}
            size="lg"
            className="mt-6 rounded-full px-6"
          >
            <ImagePlus className="mr-2 h-4 w-4" />
            Izaberi fotografije
          </Button>
        </div>
      </section>

      {/* Image grid */}
      {images.length > 0 && (
        <section className="mx-auto mt-10 max-w-6xl px-4 sm:px-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold">
              Vaše fotografije ({images.length})
            </h3>
            <button
              type="button"
              onClick={() => setImages([])}
              className="text-xs text-muted-foreground transition-colors hover:text-destructive"
            >
              Ukloni sve
            </button>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {images.map((img) => (
              <div
                key={img.id}
                className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-soft)]"
              >
                <div className="relative aspect-square bg-muted">
                  <img
                    src={img.previewUrl}
                    alt={img.fileName}
                    className="h-full w-full object-cover"
                  />
                  {img.uploading && (
                    <div className="absolute inset-0 grid place-items-center bg-background/60 backdrop-blur-sm">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => removeImg(img.id)}
                    className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-background/90 text-foreground shadow-sm transition hover:bg-destructive hover:text-destructive-foreground"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="space-y-3 p-3">
                  <Select
                    value={img.formatId}
                    onValueChange={(v) => updateImg(img.id, { formatId: v })}
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {formats.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.name} — {formatKM(Number(f.price_km))}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Kopije</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          updateImg(img.id, {
                            quantity: Math.max(1, img.quantity - 1),
                          })
                        }
                        className="grid h-8 w-8 place-items-center rounded-full border border-border hover:bg-accent"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-8 text-center text-sm font-medium tabular-nums">
                        {img.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          updateImg(img.id, { quantity: Math.min(500, img.quantity + 1) })
                        }
                        className="grid h-8 w-8 place-items-center rounded-full border border-border hover:bg-accent"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Cart + Delivery */}
      {images.length > 0 && (
        <section className="mx-auto mt-12 grid max-w-6xl gap-6 px-4 sm:px-6 lg:grid-cols-[1fr_380px]">
          <div className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-soft)] sm:p-8">
            <h3 className="text-lg font-semibold">Podaci za dostavu</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Popunite podatke za isporuku narudžbe.
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="full_name">Ime i prezime *</Label>
                <Input
                  id="full_name"
                  value={customer.full_name}
                  onChange={(e) =>
                    setCustomer({ ...customer, full_name: e.target.value })
                  }
                  className="mt-1.5"
                  placeholder="Adis Hodžić"
                />
              </div>
              <div>
                <Label htmlFor="phone">Telefon *</Label>
                <Input
                  id="phone"
                  value={customer.phone}
                  onChange={(e) =>
                    setCustomer({ ...customer, phone: e.target.value })
                  }
                  className="mt-1.5"
                  placeholder="+387 60 000 000"
                />
              </div>
              <div>
                <Label htmlFor="email">Email (opcionalno)</Label>
                <Input
                  id="email"
                  type="email"
                  value={customer.email}
                  onChange={(e) =>
                    setCustomer({ ...customer, email: e.target.value })
                  }
                  className="mt-1.5"
                  placeholder="ime@example.com"
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="address">Adresa *</Label>
                <Input
                  id="address"
                  value={customer.address}
                  onChange={(e) =>
                    setCustomer({ ...customer, address: e.target.value })
                  }
                  className="mt-1.5"
                  placeholder="Ulica i broj"
                />
              </div>
              <div>
                <Label htmlFor="city">Grad *</Label>
                <Input
                  id="city"
                  value={customer.city}
                  onChange={(e) =>
                    setCustomer({ ...customer, city: e.target.value })
                  }
                  className="mt-1.5"
                  placeholder="Sarajevo"
                />
              </div>
              <div>
                <Label htmlFor="postal_code">Poštanski broj</Label>
                <Input
                  id="postal_code"
                  value={customer.postal_code}
                  onChange={(e) =>
                    setCustomer({ ...customer, postal_code: e.target.value })
                  }
                  className="mt-1.5"
                  placeholder="71000"
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="notes">Napomena (opcionalno)</Label>
                <Textarea
                  id="notes"
                  value={customer.notes}
                  onChange={(e) =>
                    setCustomer({ ...customer, notes: e.target.value })
                  }
                  className="mt-1.5"
                  rows={3}
                  placeholder="Posebne želje, vrijeme isporuke, itd."
                />
              </div>
            </div>
          </div>

          <aside className="h-fit rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-soft)] lg:sticky lg:top-24">
            <h3 className="text-lg font-semibold">Pregled narudžbe</h3>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <dt>Fotografije</dt>
                <dd>{images.length}</dd>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <dt>Ukupno kopija</dt>
                <dd>{total.qty}</dd>
              </div>
              <div className="my-3 border-t border-border" />
              <div className="flex items-baseline justify-between">
                <dt className="text-base font-medium">Ukupno</dt>
                <dd className="text-2xl font-semibold tabular-nums">
                  {formatKM(total.sum)}
                </dd>
              </div>
            </dl>
            <Button
              size="lg"
              className="mt-6 w-full rounded-full"
              onClick={handleSubmit}
              disabled={!canSubmit}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Šaljem...
                </>
              ) : (
                "Naruči"
              )}
            </Button>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Plaćanje pouzećem prilikom dostave
            </p>
          </aside>
        </section>
      )}

      <SiteFooter />
    </div>
  );
}
