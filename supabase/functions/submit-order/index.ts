// Atomic order submission. Validates input, computes pricing from server-side
// formats/settings, and inserts orders + images + order_items with service role.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function isUuid(v: unknown): v is string {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...cors, "content-type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const {
      orderRef,
      customer,
      items,
      same_day,
      gift_packaging,
      gift_message,
    } = body ?? {};

    if (!isUuid(orderRef)) throw new Error("Neispravan orderRef.");
    if (!customer || typeof customer !== "object") throw new Error("Nedostaju podaci kupca.");
    if (!Array.isArray(items) || items.length === 0) throw new Error("Nedostaju stavke narudžbe.");
    if (items.length > 500) throw new Error("Previše stavki.");

    const required = ["full_name", "phone", "address", "city"] as const;
    for (const k of required) {
      if (typeof customer[k] !== "string" || customer[k].trim().length < 2) {
        throw new Error(`Nedostaje polje: ${k}`);
      }
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    // Server-side authoritative formats & settings
    const [{ data: formats, error: fErr }, { data: settings, error: sErr }] =
      await Promise.all([
        supabase.from("formats").select("id, name, price_km, active"),
        supabase.from("app_settings").select("*").eq("id", 1).single(),
      ]);
    if (fErr) throw new Error(fErr.message);
    if (sErr) throw new Error(sErr.message);

    const formatMap = new Map((formats ?? []).map((f: any) => [f.id, f]));

    let subtotal = 0;
    const orderItemRows: any[] = [];
    const imageRows: any[] = [];
    const imageIdByPath = new Map<string, string>();

    for (const item of items) {
      const fmt = formatMap.get(item.format_id) as any;
      if (!fmt || !fmt.active) throw new Error("Neispravan format.");
      const qty = Math.max(1, Math.min(500, Number(item.quantity) || 1));
      const lineTotal = Number(fmt.price_km) * qty;
      subtotal += lineTotal;

      let imageId: string | null = null;
      const path = item.storage_path as string | null;
      if (path) {
        imageId = imageIdByPath.get(path) ?? crypto.randomUUID();
        if (!imageIdByPath.has(path)) {
          imageIdByPath.set(path, imageId);
          imageRows.push({
            id: imageId,
            order_id: orderRef,
            storage_path: path,
            status: "active",
          });
        }
      }

      orderItemRows.push({
        id: crypto.randomUUID(),
        order_id: orderRef,
        image_id: imageId,
        format_id: fmt.id,
        format_name: fmt.name,
        price_per_unit: Number(fmt.price_km),
        quantity: qty,
        total_price: Number(lineTotal.toFixed(2)),
        notes: (item.notes ?? null) || null,
      });
    }

    const freeShip =
      !!settings?.free_shipping_enabled &&
      subtotal >= Number(settings?.free_shipping_threshold ?? 0);
    const shipping_fee = freeShip ? 0 : Number(settings?.shipping_fee ?? 0);
    const sameDay = !!same_day && !!settings?.same_day_enabled;
    const same_day_fee = sameDay ? Number(settings.same_day_price ?? 0) : 0;
    const giftPack = !!gift_packaging && !!settings?.gift_packaging_enabled;
    const gift_packaging_fee = giftPack ? Number(settings?.gift_packaging_price ?? 0) : 0;
    const giftMsgText = (gift_message ?? "").toString().trim();
    const hasGiftMsg = !!giftMsgText && !!settings?.gift_message_enabled;
    const gift_message_fee = hasGiftMsg ? Number(settings?.gift_message_price ?? 0) : 0;
    const total =
      subtotal + shipping_fee + same_day_fee + gift_packaging_fee + gift_message_fee;

    const { error: oErr } = await supabase.from("orders").insert({
      id: orderRef,
      full_name: customer.full_name,
      phone: customer.phone,
      email: customer.email || null,
      address: customer.address,
      city: customer.city,
      postal_code: customer.postal_code || null,
      notes: customer.notes || null,
      total_price: Number(total.toFixed(2)),
      shipping_fee: Number(shipping_fee.toFixed(2)),
      same_day: sameDay,
      same_day_fee: Number(same_day_fee.toFixed(2)),
      gift_packaging: giftPack,
      gift_packaging_fee: Number(gift_packaging_fee.toFixed(2)),
      gift_message: hasGiftMsg ? giftMsgText : null,
      gift_message_fee: Number(gift_message_fee.toFixed(2)),
      status: "pending",
    });
    if (oErr) throw new Error(oErr.message);

    if (imageRows.length) {
      const { error } = await supabase.from("images").insert(imageRows);
      if (error) throw new Error(error.message);
    }
    const { error: iErr } = await supabase.from("order_items").insert(orderItemRows);
    if (iErr) throw new Error(iErr.message);

    return new Response(
      JSON.stringify({ orderId: orderRef, total: Number(total.toFixed(2)) }),
      { headers: { ...cors, "content-type": "application/json" } },
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 400,
      headers: { ...cors, "content-type": "application/json" },
    });
  }
});
