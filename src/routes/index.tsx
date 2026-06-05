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
  Zap,
  BookOpen,
  Gift,
} from "lucide-react";

import { listActiveFormats, getPublicSettings } from "@/lib/api/formats.functions";
import { createSignedUploads, submitOrder } from "@/lib/api/orders.functions";
import { supabase } from "@/integrations/supabase/client";
import { formatKM } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  id: string;
  previewUrl: string;
  storagePath: string | null;
  fileName: string;
  uploading: boolean;
  formatId: string;
  quantity: number;
};

type ExtraItem = { id: string; formatId: string; quantity: number; notes: string };

function HomePage() {
  const navigate = useNavigate();
  const orderRef = useRef(crypto.randomUUID());
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [extras, setExtras] = useState<ExtraItem[]>([]);
  const [sameDay, setSameDay] = useState(false);
  const [giftPackaging, setGiftPackaging] = useState(false);
  const [giftMessage, setGiftMessage] = useState("");
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
  const settingsQuery = useQuery({
    queryKey: ["public-settings"],
    queryFn: () => getPublicSettings(),
  });
  const settings = settingsQuery.data?.settings;
  const formats = formatsQuery.data?.formats ?? [];
  const prints = formats.filter((f: any) => (f.category ?? "print") === "print");
  const albums = formats.filter((f: any) => f.category === "album");
  const gifts = formats.filter((f: any) => f.category === "gift");
  const defaultFormatId = prints[0]?.id ?? "";

  const createSignedUploadsFn = useServerFn(createSignedUploads);
  const submitOrderFn = useServerFn(submitOrder);

  const onDrop = useCallback(
    async (accepted: File[]) => {
      if (!accepted.length) return;
      if (!defaultFormatId) {
        toast.error("Formati još nisu učitani.");
        return;
      }
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
                  ? { ...img, uploading: false, storagePath: error ? null : u.path }
                  : img,
              ),
            );
            if (error) toast.error(`Greška kod otpremanja: ${file.name}`);
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

  const updateImg = (id: string, patch: Partial<UploadedImage>) =>
    setImages((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const removeImg = (id: string) => setImages((prev) => prev.filter((i) => i.id !== id));

  const addExtra = (formatId: string) =>
    setExtras((prev) => [
      ...prev,
      { id: crypto.randomUUID(), formatId, quantity: 1, notes: "" },
    ]);
  const updateExtra = (id: string, patch: Partial<ExtraItem>) =>
    setExtras((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  const removeExtra = (id: string) =>
    setExtras((prev) => prev.filter((e) => e.id !== id));

  const totals = useMemo(() => {
    let subtotal = 0;
    let qty = 0;
    for (const img of images) {
      const f = formats.find((f: any) => f.id === img.formatId);
      if (!f) continue;
      subtotal += Number(f.price_km) * img.quantity;
      qty += img.quantity;
    }
    for (const ex of extras) {
      const f = formats.find((f: any) => f.id === ex.formatId);
      if (!f) continue;
      subtotal += Number(f.price_km) * ex.quantity;
    }
    const freeShip =
      !!settings?.free_shipping_enabled &&
      subtotal >= Number(settings?.free_shipping_threshold ?? 0);
    const shipping = subtotal > 0 ? (freeShip ? 0 : Number(settings?.shipping_fee ?? 0)) : 0;
    const sameDayFee =
      sameDay && settings?.same_day_enabled ? Number(settings.same_day_price) : 0;
    const giftPackFee =
      giftPackaging && settings?.gift_packaging_enabled
        ? Number(settings.gift_packaging_price ?? 0)
        : 0;
    const giftMsgFee =
      giftMessage.trim() && settings?.gift_message_enabled
        ? Number(settings.gift_message_price ?? 0)
        : 0;
    const total = subtotal + shipping + sameDayFee + giftPackFee + giftMsgFee;
    return { subtotal, shipping, sameDayFee, giftPackFee, giftMsgFee, total, qty, freeShip };
  }, [images, extras, formats, settings, sameDay, giftPackaging, giftMessage]);

  const hasItems = images.length + extras.length > 0;
  const canSubmit =
    hasItems &&
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
      const items = [
        ...images.map((i) => ({
          storage_path: i.storagePath!,
          format_id: i.formatId,
          quantity: i.quantity,
          notes: null as string | null,
        })),
        ...extras.map((e) => ({
          storage_path: null,
          format_id: e.formatId,
          quantity: e.quantity,
          notes: e.notes?.trim() || null,
        })),
      ];
      const { orderId } = await submitOrderFn({
        data: {
          orderRef: orderRef.current,
          same_day: sameDay,
          gift_packaging: giftPackaging,
          gift_message: giftMessage.trim() || null,
          customer,
          items,
        },
      });
      toast.success("Narudžba uspješno poslana!", {
        description: "Kontaktiraćemo vas uskoro za potvrdu.",
      });
      navigate({
        to: "/porudzbina/$id",
        params: { id: orderId },
        search: { total: totals.total },
      });
    } catch (e: any) {
      toast.error(e?.message ?? "Greška kod slanja narudžbe");
    } finally {
      setSubmitting(false);
    }
  };

  const remainingForFreeShip =
    settings?.free_shipping_enabled && !totals.freeShip
      ? Math.max(0, Number(settings.free_shipping_threshold) - totals.subtotal)
      : 0;

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

        <div className="mx-auto mt-8 flex max-w-2xl flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground sm:text-sm">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5">
            <ShieldCheck className="h-3.5 w-3.5" /> Sigurno otpremanje
          </span>
          {settings?.free_shipping_enabled && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1.5 text-success">
              <Truck className="h-3.5 w-3.5" /> Besplatna dostava preko{" "}
              {formatKM(Number(settings.free_shipping_threshold))}
            </span>
          )}
          {settings?.same_day_enabled && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/15 px-3 py-1.5 text-warning-foreground">
              <Zap className="h-3.5 w-3.5" /> Same day print dostupan
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5">
            Plaćanje pouzećem
          </span>
        </div>
      </section>

      {/* Upload */}
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
          <Button type="button" onClick={open} size="lg" className="mt-6 rounded-full px-6">
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
                      {prints.map((f: any) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.name} — {formatKM(Number(f.price_km))}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <QtyInput
                    value={img.quantity}
                    onChange={(q) => updateImg(img.id, { quantity: q })}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Extras: Albums & Gifts */}
      {(albums.length > 0 || gifts.length > 0) && (
        <section className="mx-auto mt-12 max-w-6xl px-4 sm:px-6">
          <h3 className="text-lg font-semibold">Dodatni proizvodi</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Dodajte foto album ili poklon paket uz vašu narudžbu.
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {albums.length > 0 && (
              <ExtraGroup
                icon={<BookOpen className="h-4 w-4" />}
                title="Foto albumi"
                products={albums}
                onAdd={addExtra}
              />
            )}
            {gifts.length > 0 && (
              <ExtraGroup
                icon={<Gift className="h-4 w-4" />}
                title="Pokloni"
                products={gifts}
                onAdd={addExtra}
              />
            )}
          </div>
          {extras.length > 0 && (
            <div className="mt-5 space-y-3">
              {extras.map((ex) => {
                const f = formats.find((f: any) => f.id === ex.formatId);
                if (!f) return null;
                return (
                  <div
                    key={ex.id}
                    className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">{f.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatKM(Number(f.price_km))} po komadu
                        </div>
                      </div>
                      <QtyInput
                        value={ex.quantity}
                        onChange={(q) => updateExtra(ex.id, { quantity: q })}
                      />
                      <button
                        type="button"
                        onClick={() => removeExtra(ex.id)}
                        className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <Textarea
                      value={ex.notes}
                      onChange={(e) => updateExtra(ex.id, { notes: e.target.value })}
                      placeholder="Napomena za ovaj proizvod (npr. broj strana, povod, motiv, pakovanje…)"
                      className="mt-3 min-h-[60px] rounded-xl text-sm"
                    />
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Cart + Delivery */}
      {hasItems && (
        <section className="mx-auto mt-12 grid max-w-6xl gap-6 px-4 pb-16 sm:px-6 lg:grid-cols-[1fr_380px]">
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
                  onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
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
                  onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
                  className="mt-1.5"
                  placeholder="ime@example.com"
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="address">Adresa *</Label>
                <Input
                  id="address"
                  value={customer.address}
                  onChange={(e) => setCustomer({ ...customer, address: e.target.value })}
                  className="mt-1.5"
                  placeholder="Ulica i broj"
                />
              </div>
              <div>
                <Label htmlFor="city">Grad *</Label>
                <Input
                  id="city"
                  value={customer.city}
                  onChange={(e) => setCustomer({ ...customer, city: e.target.value })}
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
                  onChange={(e) => setCustomer({ ...customer, notes: e.target.value })}
                  className="mt-1.5"
                  rows={3}
                  placeholder="Posebne želje, vrijeme isporuke, itd."
                />
              </div>
            </div>
          </div>

          <aside className="h-fit space-y-4 lg:sticky lg:top-24">
            {settings?.same_day_enabled && (
              <div className="flex items-center justify-between rounded-2xl border border-warning/30 bg-warning/5 p-4">
                <div className="flex items-start gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-warning/15 text-warning-foreground">
                    <Zap className="h-4 w-4" />
                  </span>
                  <div>
                    <Label className="cursor-pointer text-sm font-semibold">
                      Same day print
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Hitna štampa istog dana · +
                      {formatKM(Number(settings.same_day_price))}
                    </p>
                  </div>
                </div>
                <Switch checked={sameDay} onCheckedChange={setSameDay} />
              </div>
            )}

            <div className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
              <h3 className="text-lg font-semibold">Pregled narudžbe</h3>
              {remainingForFreeShip > 0 && (
                <div className="mt-3 rounded-xl bg-primary/5 px-3 py-2 text-xs text-primary">
                  Dodajte još {formatKM(remainingForFreeShip)} za{" "}
                  <strong>besplatnu dostavu</strong>
                </div>
              )}
              <dl className="mt-4 space-y-2 text-sm">
                <Row label={`Fotografije (${images.length})`} value={`${totals.qty} kopija`} muted />
                {extras.length > 0 && (
                  <Row label="Dodatni proizvodi" value={`${extras.length} stavki`} muted />
                )}
                <div className="my-3 border-t border-border" />
                <Row label="Međuzbir" value={formatKM(totals.subtotal)} muted />
                <Row
                  label="Dostava"
                  value={
                    totals.shipping === 0 ? (
                      <span className="text-success">Besplatno</span>
                    ) : (
                      formatKM(totals.shipping)
                    )
                  }
                  muted
                />
                {totals.sameDayFee > 0 && (
                  <Row label="Same day print" value={formatKM(totals.sameDayFee)} muted />
                )}
                <div className="my-3 border-t border-border" />
                <div className="flex items-baseline justify-between">
                  <dt className="text-base font-medium">Ukupno</dt>
                  <dd className="text-2xl font-semibold tabular-nums">
                    {formatKM(totals.total)}
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
            </div>
          </aside>
        </section>
      )}

      <SiteFooter />
    </div>
  );
}

function QtyInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="mr-2 text-sm text-muted-foreground">Kopije</span>
      <button
        type="button"
        onClick={() => onChange(Math.max(1, value - 1))}
        className="grid h-8 w-8 place-items-center rounded-full border border-border hover:bg-accent"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <input
        type="number"
        min={1}
        max={500}
        value={value}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          if (Number.isNaN(n)) return;
          onChange(Math.max(1, Math.min(500, n)));
        }}
        className="h-8 w-14 rounded-full border border-border bg-background text-center text-sm font-medium tabular-nums outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <button
        type="button"
        onClick={() => onChange(Math.min(500, value + 1))}
        className="grid h-8 w-8 place-items-center rounded-full border border-border hover:bg-accent"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function Row({
  label,
  value,
  muted,
}: {
  label: string;
  value: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <div
      className={`flex justify-between ${muted ? "text-muted-foreground" : ""}`}
    >
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

function ExtraGroup({
  icon,
  title,
  products,
  onAdd,
}: {
  icon: React.ReactNode;
  title: string;
  products: any[];
  onAdd: (id: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
      <div className="mb-3 flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </span>
        <h4 className="text-sm font-semibold">{title}</h4>
      </div>
      <ul className="space-y-2">
        {products.map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between gap-2 rounded-xl bg-secondary/50 px-3 py-2"
          >
            <div className="min-w-0">
              <div className="text-sm font-medium">{p.name}</div>
              {p.description && (
                <div className="truncate text-[11px] text-muted-foreground">
                  {p.description}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold tabular-nums">
                {formatKM(Number(p.price_km))}
              </span>
              <button
                type="button"
                onClick={() => onAdd(p.id)}
                className="grid h-7 w-7 place-items-center rounded-full bg-primary text-primary-foreground hover:opacity-90"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

