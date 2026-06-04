import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: not an admin");
}

const BUCKET = "order-images";

// ===== Public: create signed upload URLs =====
export const createSignedUploads = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      orderRef: z.string().uuid(),
      files: z
        .array(
          z.object({
            name: z.string().min(1).max(200),
            size: z.number().int().min(1).max(25 * 1024 * 1024),
          }),
        )
        .min(1)
        .max(50),
    }),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const safeRef = data.orderRef;
    const results: Array<{ path: string; token: string; originalName: string }> = [];
    for (const f of data.files) {
      const ext = (f.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
      const path = `${safeRef}/${crypto.randomUUID()}.${ext || "jpg"}`;
      const { data: signed, error } = await supabaseAdmin.storage
        .from(BUCKET)
        .createSignedUploadUrl(path);
      if (error) throw new Error(error.message);
      results.push({ path, token: signed.token, originalName: f.name });
    }
    return { uploads: results };
  });

// ===== Public: submit order =====
export const submitOrder = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      orderRef: z.string().uuid(),
      same_day: z.boolean().default(false),
      customer: z.object({
        full_name: z.string().trim().min(2).max(120),
        phone: z.string().trim().min(5).max(40),
        email: z.string().trim().email().max(200).optional().or(z.literal("")),
        address: z.string().trim().min(3).max(300),
        city: z.string().trim().min(2).max(100),
        postal_code: z.string().trim().max(20).optional().or(z.literal("")),
        notes: z.string().trim().max(1000).optional().or(z.literal("")),
      }),
      items: z
        .array(
          z.object({
            storage_path: z.string().min(3).max(400).optional().nullable(),
            format_id: z.string().uuid(),
            quantity: z.number().int().min(1).max(500),
            notes: z.string().trim().max(500).optional().nullable(),
          }),
        )
        .min(1)
        .max(500),
    }),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Load settings
    const { data: settings } = await supabaseAdmin
      .from("app_settings")
      .select("*")
      .eq("id", 1)
      .single();

    // Load formats
    const formatIds = Array.from(new Set(data.items.map((i) => i.format_id)));
    const { data: formats, error: fErr } = await supabaseAdmin
      .from("formats")
      .select("id, name, price_km, active")
      .in("id", formatIds);
    if (fErr) throw new Error(fErr.message);
    const formatMap = new Map(formats!.map((f) => [f.id, f]));
    for (const fid of formatIds) {
      const f = formatMap.get(fid);
      if (!f || !f.active) throw new Error("Neispravan ili neaktivan format");
    }

    // Verify uploaded paths exist
    const wantedPaths = new Set(
      data.items.map((i) => i.storage_path).filter(Boolean) as string[],
    );
    if (wantedPaths.size) {
      const { data: listed, error: lErr } = await supabaseAdmin.storage
        .from(BUCKET)
        .list(data.orderRef, { limit: 1000 });
      if (lErr) throw new Error(lErr.message);
      const present = new Set((listed ?? []).map((o) => `${data.orderRef}/${o.name}`));
      for (const p of wantedPaths) {
        if (!present.has(p)) throw new Error("Neke otpremljene slike nedostaju");
      }
    }

    let subtotal = 0;
    const itemsToInsert: Array<{
      format_id: string;
      format_name: string;
      price_per_unit: number;
      quantity: number;
      total_price: number;
      storage_path: string | null;
      notes: string | null;
    }> = [];
    for (const it of data.items) {
      const f = formatMap.get(it.format_id)!;
      const lineTotal = Number(f.price_km) * it.quantity;
      subtotal += lineTotal;
      itemsToInsert.push({
        format_id: f.id,
        format_name: f.name,
        price_per_unit: Number(f.price_km),
        quantity: it.quantity,
        total_price: Number(lineTotal.toFixed(2)),
        storage_path: it.storage_path ?? null,
        notes: it.notes?.trim() || null,
      });
    }

    // Shipping + same day
    const freeShip =
      !!settings?.free_shipping_enabled &&
      subtotal >= Number(settings?.free_shipping_threshold ?? 0);
    const shipping_fee = freeShip ? 0 : Number(settings?.shipping_fee ?? 0);
    const same_day = data.same_day && !!settings?.same_day_enabled;
    const same_day_fee = same_day ? Number(settings?.same_day_price ?? 0) : 0;
    const total = subtotal + shipping_fee + same_day_fee;

    const { data: order, error: oErr } = await supabaseAdmin
      .from("orders")
      .insert({
        id: data.orderRef,
        full_name: data.customer.full_name,
        phone: data.customer.phone,
        email: data.customer.email || null,
        address: data.customer.address,
        city: data.customer.city,
        postal_code: data.customer.postal_code || null,
        notes: data.customer.notes || null,
        total_price: Number(total.toFixed(2)),
        shipping_fee: Number(shipping_fee.toFixed(2)),
        same_day,
        same_day_fee: Number(same_day_fee.toFixed(2)),
        status: "pending",
      })
      .select("id, order_number")
      .single();
    if (oErr) throw new Error(oErr.message);

    // Image rows (only for items with storage_path)
    const uniquePaths = Array.from(wantedPaths);
    const pathToImageId = new Map<string, string>();
    if (uniquePaths.length) {
      const { data: insertedImages, error: iErr } = await supabaseAdmin
        .from("images")
        .insert(
          uniquePaths.map((p) => ({ order_id: order.id, storage_path: p, status: "active" })),
        )
        .select("id, storage_path");
      if (iErr) throw new Error(iErr.message);
      for (const r of insertedImages!) pathToImageId.set(r.storage_path, r.id);
    }

    const orderItems = itemsToInsert.map((it) => ({
      order_id: order.id,
      image_id: it.storage_path ? pathToImageId.get(it.storage_path) ?? null : null,
      format_id: it.format_id,
      format_name: it.format_name,
      price_per_unit: it.price_per_unit,
      quantity: it.quantity,
      total_price: it.total_price,
      notes: it.notes,
    }));
    const { error: oiErr } = await supabaseAdmin.from("order_items").insert(orderItems);
    if (oiErr) throw new Error(oiErr.message);

    return {
      orderId: order.id,
      orderNumber: order.order_number,
      total: Number(total.toFixed(2)),
    };
  });


// ===== Public: fetch confirmation summary (id acts as access token) =====
export const getOrderConfirmation = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select(
        "id, order_number, full_name, phone, email, address, city, postal_code, total_price, shipping_fee, same_day, same_day_fee, status, created_at",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!order) throw new Error("Narudžba nije pronađena");
    return { order };
  });

// ===== Admin =====
export const adminListOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ status: z.string().optional() }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("orders")
      .select(
        "id, order_number, full_name, city, phone, total_price, status, created_at, shipped_at, same_day",
      )
      .order("created_at", { ascending: false })
      .limit(500);
    if (data.status && data.status !== "all") q = q.eq("status", data.status as any);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { orders: rows ?? [] };
  });

export const adminGetOrder = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: order, error: oErr } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("id", data.id)
      .single();
    if (oErr) throw new Error(oErr.message);

    const { data: items, error: iErr } = await supabaseAdmin
      .from("order_items")
      .select("*, images(storage_path, status)")
      .eq("order_id", data.id);
    if (iErr) throw new Error(iErr.message);

    const { data: images, error: imErr } = await supabaseAdmin
      .from("images")
      .select("*")
      .eq("order_id", data.id)
      .order("uploaded_at", { ascending: true });
    if (imErr) throw new Error(imErr.message);

    const paths = images!.filter((i) => i.status === "active").map((i) => i.storage_path);
    let signedMap: Record<string, string> = {};
    if (paths.length) {
      const { data: signed } = await supabaseAdmin.storage
        .from(BUCKET)
        .createSignedUrls(paths, 3600);
      for (const s of signed ?? []) {
        if (s.path && s.signedUrl) signedMap[s.path] = s.signedUrl;
      }
    }
    return { order, items, images, signedUrls: signedMap };
  });

export const adminUpdateOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().uuid(),
      status: z.enum([
        "pending",
        "in_progress",
        "printed",
        "shipped",
        "completed",
        "cancelled",
      ]),
    }),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("orders")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: img } = await supabaseAdmin
      .from("images")
      .select("storage_path")
      .eq("id", data.id)
      .single();
    if (img?.storage_path) {
      await supabaseAdmin.storage.from(BUCKET).remove([img.storage_path]);
    }
    await supabaseAdmin
      .from("images")
      .update({ status: "deleted" })
      .eq("id", data.id);
    return { ok: true };
  });

export const adminDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("orders")
      .select("status, total_price");
    if (error) throw new Error(error.message);
    const { data: exp } = await supabaseAdmin.from("expenses").select("amount_km");
    const revenue = rows!
      .filter((r) => r.status !== "cancelled")
      .reduce((s, r) => s + Number(r.total_price), 0);
    const expensesTotal = (exp ?? []).reduce((s, r: any) => s + Number(r.amount_km), 0);
    const stats = {
      total: rows!.length,
      pending: rows!.filter((r) => r.status === "pending").length,
      inProgress: rows!.filter((r) => r.status === "in_progress").length,
      shipped: rows!.filter((r) => r.status === "shipped").length,
      completed: rows!.filter((r) => r.status === "completed").length,
      revenue,
      expenses: expensesTotal,
      profit: revenue - expensesTotal,
    };
    return { stats };
  });
