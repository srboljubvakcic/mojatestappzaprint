import { supabase } from "@/integrations/supabase/client";

const BUCKET = "order-images";

// ---------- helpers ----------
function ext(name: string) {
  const e = (name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  return e || "jpg";
}

// ---------- Public: formats & settings ----------
export async function listActiveFormats() {
  const { data, error } = await supabase
    .from("formats")
    .select("id, name, price_km, description, sort_order, category, active")
    .eq("active", true)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return { formats: data ?? [] };
}

export async function getPublicSettings() {
  const { data, error } = await supabase
    .from("app_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return { settings: data };
}

// ---------- Public: client-side direct upload (replaces signed-upload server fn) ----------
export async function createSignedUploads(arg: {
  data: { orderRef: string; files: Array<{ name: string; size: number }> };
}) {
  // We don't need server-side signed URLs anymore. Just return planned paths;
  // the client will upload directly. Token left blank (uploadToSignedUrl is no longer used).
  const { orderRef, files } = arg.data;
  const uploads = files.map((f) => ({
    path: `${orderRef}/${crypto.randomUUID()}.${ext(f.name)}`,
    token: "",
    originalName: f.name,
  }));
  return { uploads };
}

// ---------- Public: submit order via edge function (atomic + server-validated) ----------
export async function submitOrder(arg: {
  data: {
    orderRef: string;
    same_day: boolean;
    gift_packaging: boolean;
    gift_message: string | null;
    customer: {
      full_name: string;
      phone: string;
      email: string;
      address: string;
      city: string;
      postal_code: string;
      notes: string;
    };
    items: Array<{
      storage_path: string | null;
      format_id: string;
      quantity: number;
      notes: string | null;
    }>;
  };
}) {
  const { data, error } = await supabase.functions.invoke("submit-order", {
    body: arg.data,
  });
  if (error) throw new Error(error.message);
  if ((data as any)?.error) throw new Error((data as any).error);
  return { orderId: (data as any).orderId, total: (data as any).total };
}

export async function getOrderConfirmation(arg: { data: { id: string } }) {
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, order_number, full_name, phone, email, address, city, postal_code, total_price, created_at",
    )
    .eq("id", arg.data.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return { order: data };
}

// ---------- Admin: role check ----------
export async function checkIsAdmin() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { isAdmin: false };
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return { isAdmin: !!data };
}

// ---------- Admin: formats ----------
export async function adminListAllFormats() {
  const { data, error } = await supabase
    .from("formats")
    .select("*")
    .order("category", { ascending: true })
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return { formats: data ?? [] };
}

export async function adminUpsertFormat(arg: {
  data: {
    id?: string;
    name: string;
    price_km: number;
    description: string | null;
    active: boolean;
    sort_order: number;
    category: string;
  };
}) {
  const { id, ...payload } = arg.data;
  if (id) {
    const { error } = await supabase.from("formats").update(payload).eq("id", id);
    if (error) throw new Error(error.message);
    return { id };
  }
  const { data, error } = await supabase
    .from("formats")
    .insert(payload as any)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { id: data.id };
}

export async function adminDeleteFormat(arg: { data: { id: string } }) {
  const { error } = await supabase.from("formats").delete().eq("id", arg.data.id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

// ---------- Admin: settings ----------
export async function adminGetSettings() {
  const { data, error } = await supabase
    .from("app_settings")
    .select("*")
    .eq("id", 1)
    .single();
  if (error) throw new Error(error.message);
  return { settings: data };
}

export async function adminUpdateSettings(arg: { data: Record<string, any> }) {
  const { error } = await supabase.from("app_settings").update(arg.data as any).eq("id", 1);
  if (error) throw new Error(error.message);
  return { ok: true };
}

// ---------- Admin: expenses ----------
export async function adminListExpenses() {
  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .order("occurred_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);
  const expenses = data ?? [];
  const total = expenses.reduce((s: number, r: any) => s + Number(r.amount_km), 0);
  return { expenses, total };
}

export async function adminUpsertExpense(arg: {
  data: {
    id?: string;
    name: string;
    amount_km: number;
    category: string;
    occurred_at: string;
    notes: string | null;
  };
}) {
  const { id, ...payload } = arg.data;
  if (id) {
    const { error } = await supabase.from("expenses").update(payload).eq("id", id);
    if (error) throw new Error(error.message);
    return { id };
  }
  const { data, error } = await supabase
    .from("expenses")
    .insert(payload as any)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { id: data.id };
}

export async function adminDeleteExpense(arg: { data: { id: string } }) {
  const { error } = await supabase.from("expenses").delete().eq("id", arg.data.id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

// ---------- Admin: orders ----------
export async function adminListOrders(arg?: { data?: { status?: string } }) {
  const status = arg?.data?.status ?? "all";
  let q = supabase
    .from("orders")
    .select(
      "id, order_number, full_name, city, phone, total_price, status, created_at, shipped_at, same_day",
    )
    .order("created_at", { ascending: false })
    .limit(500);
  if (status !== "all") q = q.eq("status", status as any);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return { orders: data ?? [] };
}

export async function adminGetOrder(arg: { data: { id: string } }) {
  const id = arg.data.id;
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("*")
    .eq("id", id)
    .single();
  if (orderErr) throw new Error(orderErr.message);

  const { data: items, error: itemsErr } = await supabase
    .from("order_items")
    .select("*, images(storage_path, status)")
    .eq("order_id", id);
  if (itemsErr) throw new Error(itemsErr.message);

  const { data: images, error: imgErr } = await supabase
    .from("images")
    .select("*")
    .eq("order_id", id)
    .order("uploaded_at", { ascending: true });
  if (imgErr) throw new Error(imgErr.message);

  const activePaths = (images ?? [])
    .filter((i: any) => i.status === "active")
    .map((i: any) => i.storage_path);
  const signedUrls: Record<string, string> = {};
  if (activePaths.length) {
    const { data: signed, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrls(activePaths, 3600);
    if (error) throw new Error(error.message);
    for (const s of signed ?? []) {
      if (s.path && s.signedUrl) signedUrls[s.path] = s.signedUrl;
    }
  }
  return { order, items: items ?? [], images: images ?? [], signedUrls };
}

export async function adminUpdateOrderStatus(arg: {
  data: { id: string; status: string };
}) {
  const { error } = await supabase
    .from("orders")
    .update({ status: arg.data.status as any })
    .eq("id", arg.data.id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function adminUpdateOrder(arg: { data: { id: string } & Record<string, any> }) {
  const { id, ...payload } = arg.data;
  const { error } = await supabase.from("orders").update(payload as any).eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function adminDeleteImage(arg: { data: { id: string } }) {
  const id = arg.data.id;
  const { data, error } = await supabase
    .from("images")
    .select("storage_path")
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  if (data?.storage_path) {
    await supabase.storage.from(BUCKET).remove([data.storage_path]);
  }
  const { error: updErr } = await supabase
    .from("images")
    .update({ status: "deleted" })
    .eq("id", id);
  if (updErr) throw new Error(updErr.message);
  return { ok: true };
}

// ---------- Admin: dashboard / reports ----------
function net(r: any) {
  return Number(r.total_price) - Number(r.shipping_fee ?? 0);
}

export async function adminDashboardStats() {
  const { data: orders, error } = await supabase
    .from("orders")
    .select("status, total_price, shipping_fee, created_at");
  if (error) throw new Error(error.message);

  const { data: exps, error: expErr } = await supabase
    .from("expenses")
    .select("amount_km");
  if (expErr) throw new Error(expErr.message);

  const rows = orders ?? [];
  const completedRows = rows.filter((r: any) => r.status === "completed");
  const pendingRows = rows.filter(
    (r: any) => !["cancelled", "completed"].includes(r.status),
  );
  const revenue = completedRows.reduce((s, r) => s + net(r), 0);
  const pendingRevenue = pendingRows.reduce((s, r) => s + net(r), 0);
  const expensesTotal = (exps ?? []).reduce(
    (s: number, r: any) => s + Number(r.amount_km),
    0,
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daily: Array<{ date: string; orders: number; revenue: number }> = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    daily.push({ date: d.toISOString().slice(0, 10), orders: 0, revenue: 0 });
  }
  const dm = new Map(daily.map((e) => [e.date, e]));
  for (const r of rows) {
    const k = new Date(r.created_at).toISOString().slice(0, 10);
    const b = dm.get(k);
    if (!b) continue;
    b.orders += 1;
    if (r.status === "completed") b.revenue += net(r);
  }

  const monthly: Array<{ month: string; orders: number; revenue: number }> = [];
  const first = new Date(today.getFullYear(), today.getMonth(), 1);
  for (let i = 11; i >= 0; i--) {
    const d = new Date(first);
    d.setMonth(first.getMonth() - i);
    monthly.push({
      month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      orders: 0,
      revenue: 0,
    });
  }
  const mm = new Map(monthly.map((e) => [e.month, e]));
  for (const r of rows) {
    const d = new Date(r.created_at);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const b = mm.get(k);
    if (!b) continue;
    b.orders += 1;
    if (r.status === "completed") b.revenue += net(r);
  }

  return {
    stats: {
      total: rows.length,
      pending: rows.filter((r: any) => r.status === "pending").length,
      inProgress: rows.filter((r: any) => r.status === "in_progress").length,
      shipped: rows.filter((r: any) => r.status === "shipped").length,
      completed: completedRows.length,
      revenue,
      pendingRevenue,
      expenses: expensesTotal,
      profit: revenue - expensesTotal,
      daily,
      monthly,
    },
  };
}

export async function adminRecentOrders() {
  const { data, error } = await supabase
    .from("orders")
    .select("id, order_number, full_name, city, total_price, status, created_at")
    .order("created_at", { ascending: false })
    .limit(8);
  if (error) throw new Error(error.message);
  return { orders: data ?? [] };
}

export async function adminReports(arg?: { data?: { month?: string } }) {
  const month = arg?.data?.month;
  const { data: ordersAll, error } = await supabase
    .from("orders")
    .select("id, status, total_price, shipping_fee, city, created_at");
  if (error) throw new Error(error.message);

  const { data: itemsAll, error: itErr } = await supabase
    .from("order_items")
    .select("order_id, format_name, quantity, total_price");
  if (itErr) throw new Error(itErr.message);

  const { data: expsAll, error: exErr } = await supabase
    .from("expenses")
    .select("amount_km, category, occurred_at");
  if (exErr) throw new Error(exErr.message);

  const availableMonths = [
    ...new Set(
      (ordersAll ?? []).map((o: any) => {
        const d = new Date(o.created_at);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      }),
    ),
  ]
    .sort()
    .reverse();

  let orders = ordersAll ?? [];
  let items = itemsAll ?? [];
  let expenses = expsAll ?? [];

  if (month) {
    const [y, m] = month.split("-").map(Number);
    const start = new Date(y, m - 1, 1).getTime();
    const end = new Date(y, m, 1).getTime();
    const inM = (v: string) => {
      const t = new Date(v).getTime();
      return t >= start && t < end;
    };
    orders = orders.filter((o: any) => inM(o.created_at));
    const ids = new Set(orders.map((o: any) => o.id));
    items = items.filter((it: any) => ids.has(it.order_id));
    expenses = expenses.filter((e: any) => inM(e.occurred_at));
  }

  const completed = orders.filter((o: any) => o.status === "completed");
  const cancelled = orders.filter((o: any) => o.status === "cancelled");

  const now = new Date();
  const startThis = new Date(now.getFullYear(), now.getMonth(), 1);
  const startLast = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const inR = (v: string, f: Date, t: Date) => {
    const x = new Date(v).getTime();
    return x >= f.getTime() && x < t.getTime();
  };
  const thisMonthOrders = orders.filter((o: any) =>
    inR(o.created_at, startThis, new Date(now.getFullYear(), now.getMonth() + 1, 1)),
  );
  const lastMonthOrders = orders.filter((o: any) =>
    inR(o.created_at, startLast, startThis),
  );
  const thisMonthRevenue = thisMonthOrders
    .filter((o: any) => o.status === "completed")
    .reduce((s, r) => s + net(r), 0);
  const lastMonthRevenue = lastMonthOrders
    .filter((o: any) => o.status === "completed")
    .reduce((s, r) => s + net(r), 0);

  const cityMap = new Map<string, { city: string; orders: number; revenue: number }>();
  for (const o of orders) {
    const k = (o.city || "—").trim();
    const e = cityMap.get(k) ?? { city: k, orders: 0, revenue: 0 };
    e.orders++;
    if (o.status === "completed") e.revenue += net(o);
    cityMap.set(k, e);
  }
  const topCities = [...cityMap.values()].sort((a, b) => b.orders - a.orders).slice(0, 8);

  const fmtMap = new Map<string, { name: string; quantity: number; revenue: number }>();
  for (const it of items) {
    const k = it.format_name;
    const e = fmtMap.get(k) ?? { name: k, quantity: 0, revenue: 0 };
    e.quantity += Number(it.quantity);
    e.revenue += Number(it.total_price);
    fmtMap.set(k, e);
  }
  const topFormats = [...fmtMap.values()]
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 8);

  const expMap = new Map<string, number>();
  for (const e of expenses) {
    expMap.set(e.category, (expMap.get(e.category) ?? 0) + Number(e.amount_km));
  }
  const expenseByCategory = [...expMap.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

  const statusDist: Record<string, number> = {};
  for (const o of orders) statusDist[o.status] = (statusDist[o.status] ?? 0) + 1;

  const totalRevenue = completed.reduce((s, r) => s + net(r), 0);
  const totalExpenses = expenses.reduce((s: number, r: any) => s + Number(r.amount_km), 0);

  return {
    report: {
      totals: {
        orders: orders.length,
        completed: completed.length,
        cancelled: cancelled.length,
        revenue: totalRevenue,
        expenses: totalExpenses,
        profit: totalRevenue - totalExpenses,
        avgOrderValue: completed.length ? totalRevenue / completed.length : 0,
        completionRate: orders.length ? (completed.length / orders.length) * 100 : 0,
      },
      thisMonth: { orders: thisMonthOrders.length, revenue: thisMonthRevenue },
      lastMonth: { orders: lastMonthOrders.length, revenue: lastMonthRevenue },
      topCities,
      topFormats,
      expenseByCategory,
      statusDist,
      availableMonths,
      month: month ?? null,
    },
  };
}
