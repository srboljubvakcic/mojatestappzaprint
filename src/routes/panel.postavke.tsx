import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Truck, Zap, Save, Gift, MessageSquareHeart, MessageCircle, Percent } from "lucide-react";
import { toast } from "sonner";

import {
  adminGetSettings,
  adminUpdateSettings,
} from "@/lib/app-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/panel/postavke")({
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const getFn = useServerFn(adminGetSettings);
  const updateFn = useServerFn(adminUpdateSettings);
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "settings"],
    queryFn: () => getFn(),
  });

  const [form, setForm] = useState({
    free_shipping_enabled: true,
    free_shipping_threshold: 200,
    shipping_fee: 10,
    same_day_enabled: false,
    same_day_price: 15,
    gift_packaging_enabled: false,
    gift_packaging_price: 3,
    gift_message_enabled: false,
    gift_message_price: 1,
    support_enabled: true,
    support_phone: "+387 60 000 0000",
    volume_discount_enabled: false,
    volume_discount_threshold: 50,
    volume_discount_percent: 10,
  });

  useEffect(() => {
    if (data?.settings) {
      setForm({
        free_shipping_enabled: !!data.settings.free_shipping_enabled,
        free_shipping_threshold: Number(data.settings.free_shipping_threshold),
        shipping_fee: Number(data.settings.shipping_fee),
        same_day_enabled: !!data.settings.same_day_enabled,
        same_day_price: Number(data.settings.same_day_price),
        gift_packaging_enabled: !!data.settings.gift_packaging_enabled,
        gift_packaging_price: Number(data.settings.gift_packaging_price ?? 3),
        gift_message_enabled: !!data.settings.gift_message_enabled,
        gift_message_price: Number(data.settings.gift_message_price ?? 1),
        support_enabled: data.settings.support_enabled ?? true,
        support_phone: data.settings.support_phone ?? "+387 60 000 0000",
        volume_discount_enabled: !!data.settings.volume_discount_enabled,
        volume_discount_threshold: Number(data.settings.volume_discount_threshold ?? 50),
        volume_discount_percent: Number(data.settings.volume_discount_percent ?? 10),
      });
    }
  }, [data]);


  const saveMut = useMutation({
    mutationFn: () => updateFn({ data: form }),
    onSuccess: () => {
      toast.success("Postavke sačuvane");
      qc.invalidateQueries({ queryKey: ["admin", "settings"] });
      qc.invalidateQueries({ queryKey: ["public-settings"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) {
    return <div className="p-10 text-sm text-muted-foreground">Učitavanje...</div>;
  }

  return (
    <div className="p-6 sm:p-10">
      <h1 className="text-3xl font-semibold tracking-tight">Postavke</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Pravila dostave i premium opcije.
      </p>

      <div className="mt-6 max-w-2xl space-y-5">
        <Card icon={<MessageCircle className="h-4 w-4" />} title="Dugme podrške (WhatsApp)">
          <div className="flex items-center justify-between rounded-xl bg-secondary px-4 py-3">
            <div>
              <Label className="cursor-pointer">Prikaži dugme "Podrška" u zaglavlju</Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Otvara WhatsApp chat na broj ispod
              </p>
            </div>
            <Switch
              checked={form.support_enabled}
              onCheckedChange={(v) => setForm({ ...form, support_enabled: v })}
            />
          </div>
          <div>
            <Label>Broj telefona (WhatsApp)</Label>
            <Input
              type="tel"
              value={form.support_phone}
              onChange={(e) => setForm({ ...form, support_phone: e.target.value })}
              className="mt-1.5"
              placeholder="+387 60 000 0000"
              disabled={!form.support_enabled}
            />
          </div>
        </Card>

        <Card icon={<Truck className="h-4 w-4" />} title="Dostava">
          <div className="flex items-center justify-between rounded-xl bg-secondary px-4 py-3">
            <div>
              <Label className="cursor-pointer">Besplatna dostava preko praga</Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Prikazuje se korisniku na naslovnoj stranici
              </p>
            </div>
            <Switch
              checked={form.free_shipping_enabled}
              onCheckedChange={(v) => setForm({ ...form, free_shipping_enabled: v })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Prag (KM)</Label>
              <Input
                type="number"
                min="0"
                step="1"
                value={form.free_shipping_threshold}
                onChange={(e) =>
                  setForm({ ...form, free_shipping_threshold: Number(e.target.value) })
                }
                className="mt-1.5"
                disabled={!form.free_shipping_enabled}
              />
            </div>
            <div>
              <Label>Cijena dostave (KM)</Label>
              <Input
                type="number"
                min="0"
                step="0.5"
                value={form.shipping_fee}
                onChange={(e) =>
                  setForm({ ...form, shipping_fee: Number(e.target.value) })
                }
                className="mt-1.5"
              />
            </div>
          </div>
        </Card>

        <Card icon={<Zap className="h-4 w-4" />} title="Štampa istog dana">
          <div className="flex items-center justify-between rounded-xl bg-secondary px-4 py-3">
            <div>
              <Label className="cursor-pointer">Omogući štampa istog dana</Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Korisnici mogu izabrati hitnu štampu za dodatnu naknadu
              </p>
            </div>
            <Switch
              checked={form.same_day_enabled}
              onCheckedChange={(v) => setForm({ ...form, same_day_enabled: v })}
            />
          </div>
          <div>
            <Label>Cijena štampe istog dana (KM)</Label>
            <Input
              type="number"
              min="0"
              step="0.5"
              value={form.same_day_price}
              onChange={(e) =>
                setForm({ ...form, same_day_price: Number(e.target.value) })
              }
              className="mt-1.5"
              disabled={!form.same_day_enabled}
            />
          </div>
        </Card>

        <Card icon={<Gift className="h-4 w-4" />} title="Premium poklon pakovanje">
          <div className="flex items-center justify-between rounded-xl bg-secondary px-4 py-3">
            <div>
              <Label className="cursor-pointer">Omogući poklon pakovanje</Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Korisnik može izabrati premium pakovanje uz doplatu
              </p>
            </div>
            <Switch
              checked={form.gift_packaging_enabled}
              onCheckedChange={(v) => setForm({ ...form, gift_packaging_enabled: v })}
            />
          </div>
          <div>
            <Label>Cijena poklon pakovanja (KM)</Label>
            <Input
              type="number"
              min="0"
              step="0.5"
              value={form.gift_packaging_price}
              onChange={(e) =>
                setForm({ ...form, gift_packaging_price: Number(e.target.value) })
              }
              className="mt-1.5"
              disabled={!form.gift_packaging_enabled}
            />
          </div>
        </Card>

        <Card icon={<MessageSquareHeart className="h-4 w-4" />} title="Poklon poruka">
          <div className="flex items-center justify-between rounded-xl bg-secondary px-4 py-3">
            <div>
              <Label className="cursor-pointer">Omogući poklon poruku</Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Korisnik može napisati ličnu poruku uz dodatnu naknadu
              </p>
            </div>
            <Switch
              checked={form.gift_message_enabled}
              onCheckedChange={(v) => setForm({ ...form, gift_message_enabled: v })}
            />
          </div>
          <div>
            <Label>Cijena poklon poruke (KM)</Label>
            <Input
              type="number"
              min="0"
              step="0.5"
              value={form.gift_message_price}
              onChange={(e) =>
                setForm({ ...form, gift_message_price: Number(e.target.value) })
              }
              className="mt-1.5"
              disabled={!form.gift_message_enabled}
            />
          </div>
        </Card>

        <div className="flex justify-end">
          <Button
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending}
            size="lg"
            className="rounded-full"
          >
            <Save className="mr-2 h-4 w-4" />
            {saveMut.isPending ? "Spremam..." : "Sačuvaj postavke"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Card({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
      <div className="mb-4 flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </span>
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}
