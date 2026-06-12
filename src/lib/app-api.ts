import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type FormatRow = Database["public"]["Tables"]["formats"]["Row"];
export type AppSettingsRow = Database["public"]["Tables"]["app_settings"]["Row"];
export type ExpenseRow = Database["public"]["Tables"]["expenses"]["Row"];
export type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
export type ImageRow = Database["public"]["Tables"]["images"]["Row"];
export type OrderItemRow = Database["public"]["Tables"]["order_items"]["Row"];
export type OrderStatus = Database["public"]["Enums"]["order_status"];

const BUCKET = "order-images";

export type OrderItemInput = {
  storage_path: string | null;
  format_id: string;
  quantity: number;
  notes: string | null;
};

export type OrderCustomerInput = {
  full_name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  postal_code: string;
  notes: string;
};

export type OrderConfirmationSummary = {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  address: string;
  city: string;
  postal_code: string | null;
  total_price: number;
  created_at: string;
  order_number?: number | null;
};

function ensure<T>(data: T | null, error: { message: string } | null | undefined): T {
  if (error) throw new Error(error.message);
  if (data === null) throw new Error("Traženi podaci nisu pronađeni.");
  return data;
}

function fileExtension(name: string) {
  const ext = (name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  return ext || "jpg";
}

export async function listActiveFormats() {
  const { data, error } = await supabase
    .from("formats")
    .select("id, name, price_km, description, sort_order, category, active")
    .eq("active", true)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getPublicSettings() {
  const { data, error } = await supabase
    .from("app_settings")
    .select("*")
    .eq("id", 1)
    .single();

  return ensure(data, error);
}

export async function uploadOrderFile(orderRef: string, file: File) {
  const path = `${orderRef}/${crypto.randomUUID()}.${fileExtension(file.name)}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || "image/jpeg",
    upsert: false,
  });

  if (error) throw new Error(error.message);
  return path;
}

export async function submitOrder(params: {
  orderRef: string;
  customer: OrderCustomerInput;
  items: OrderItemInput[];
  formats: Pick<FormatRow, "id" | "name" | "price_km" | "active">[];
  settings: AppSettingsRow;
  same_day: boolean;
  gift_packaging: boolean;
  gift_message: string | null;
}) {
  const formatMap = new Map(params.formats.map((format) => [format.id, format]));

  let subtotal = 0;
  const itemsToInsert: Array<{
    id: string;
    image_id: string | null;
    format_id: string;
    format_name: string;
    price_per_unit: number;
    quantity: number;
    total_price: number;
    notes: string | null;
  }> = [];

  const imageRows: Database["public"]["Tables"]["images"]["Insert"][] = [];
  const imageIdByPath = new Map<string, string>();

  for (const item of params.items) {
    const format = formatMap.get(item.format_id);
    if (!format || !format.active) throw new Error("Neispravan ili neaktivan format.");

    const lineTotal = Number(format.price_km) * item.quantity;
    subtotal += lineTotal;

    let imageId: string | null = null;
    if (item.storage_path) {
      imageId = imageIdByPath.get(item.storage_path) ?? crypto.randomUUID();
      if (!imageIdByPath.has(item.storage_path)) {
        imageIdByPath.set(item.storage_path, imageId);
        imageRows.push({
          id: imageId,
          order_id: params.orderRef,
          storage_path: item.storage_path,
          status: "active",
        });
      }
    }

    itemsToInsert.push({
      id: crypto.randomUUID(),
      image_id: imageId,
      format_id: format.id,
      format_name: format.name,
      price_per_unit: Number(format.price_km),
      quantity: item.quantity,
      total_price: Number(lineTotal.toFixed(2)),
      notes: item.notes?.trim() || null,
    });
  }

  const freeShip =
    params.settings.free_shipping_enabled &&
    subtotal >= Number(params.settings.free_shipping_threshold ?? 0);
  const shipping_fee = freeShip ? 0 : Number(params.settings.shipping_fee ?? 0);
  const same_day = params.same_day && params.settings.same_day_enabled;
  const same_day_fee = same_day ? Number(params.settings.same_day_price ?? 0) : 0;
  const gift_packaging = params.gift_packaging && params.settings.gift_packaging_enabled;
  const gift_packaging_fee = gift_packaging
    ? Number(params.settings.gift_packaging_price ?? 0)
    : 0;
  const giftMessageText = params.gift_message?.trim() || "";
  const hasGiftMessage = !!giftMessageText && params.settings.gift_message_enabled;
  const gift_message_fee = hasGiftMessage ? Number(params.settings.gift_message_price ?? 0) : 0;
  const total = subtotal + shipping_fee + same_day_fee + gift_packaging_fee + gift_message_fee;

  const createdAt = new Date().toISOString();

  const { error: orderError } = await supabase.from("orders").insert({
    id: params.orderRef,
    full_name: params.customer.full_name,
    phone: params.customer.phone,
    email: params.customer.email || null,
    address: params.customer.address,
    city: params.customer.city,
    postal_code: params.customer.postal_code || null,
    notes: params.customer.notes || null,
    total_price: Number(total.toFixed(2)),
    shipping_fee: Number(shipping_fee.toFixed(2)),
    same_day,
    same_day_fee: Number(same_day_fee.toFixed(2)),
    gift_packaging,
    gift_packaging_fee: Number(gift_packaging_fee.toFixed(2)),
    gift_message: hasGiftMessage ? giftMessageText : null,
    gift_message_fee: Number(gift_message_fee.toFixed(2)),
    status: "pending",
    created_at: createdAt,
  });
  if (orderError) throw new Error(orderError.message);

  if (imageRows.length) {
    const { error } = await supabase.from("images").insert(imageRows);
    if (error) throw new Error(error.message);
  }

  const { error: itemsError } = await supabase.from("order_items").insert(
    itemsToInsert.map((item) => ({
      id: item.id,
      order_id: params.orderRef,
      image_id: item.image_id,
      format_id: item.format_id,
      format_name: item.format_name,
      price_per_unit: item.price_per_unit,
      quantity: item.quantity,
      total_price: item.total_price,
      notes: item.notes,
    })),
  );
  if (itemsError) throw new Error(itemsError.message);

  return {
    orderId: params.orderRef,
    total: Number(total.toFixed(2)),
    confirmation: {
      id: params.orderRef,
      full_name: params.customer.full_name,
      phone: params.customer.phone,
      email: params.customer.email || null,
      address: params.customer.address,
      city: params.customer.city,
      postal_code: params.customer.postal_code || null,
      total_price: Number(total.toFixed(2)),
      created_at: createdAt,
      order_number: null,
    } satisfies OrderConfirmationSummary,
  };
}

export async function isAdminUser() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw new Error(userError.message);
  if (!user) return false;

  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (error) throw new Error(error.message);
  return !!data;
}

export async function adminListAllFormats() {
  const { data, error } = await supabase
    .from("formats")
    .select("*")
    .order("category", { ascending: true })
    .order("sort_order", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function adminUpsertFormat(
  payload: Omit<Database["public"]["Tables"]["formats"]["Update"], "updated_at" | "created_at"> & {
    id?: string;
    name: string;
    price_km: number;
    active: boolean;
    sort_order: number;
    category: string;
  },
) {
  if (payload.id) {
    const { error } = await supabase.from("formats").update(payload).eq("id", payload.id);
    if (error) throw new Error(error.message);
    return payload.id;
  }

  const { data, error } = await supabase.from("formats").insert(payload).select("id").single();
  if (error) throw new Error(error.message);
  return data.id;
}

export async function adminDeleteFormat(id: string) {
  const { error } = await supabase.from("formats").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function adminGetSettings() {
  const { data, error } = await supabase.from("app_settings").select("*").eq("id", 1).single();
  return ensure(data, error);
}

export async function adminUpdateSettings(
  payload: Database["public"]["Tables"]["app_settings"]["Update"],
) {
  const { error } = await supabase.from("app_settings").update(payload).eq("id", 1);
  if (error) throw new Error(error.message);
}

export async function adminListExpenses() {
  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .order("occurred_at", { ascending: false })
    .limit(500);

  if (error) throw new Error(error.message);
  const expenses = data ?? [];
  const total = expenses.reduce((sum, row) => sum + Number(row.amount_km), 0);
  return { expenses, total };
}

export async function adminUpsertExpense(
  payload: Omit<Database["public"]["Tables"]["expenses"]["Update"], "created_at"> & {
    id?: string;
    name: string;
    amount_km: number;
    category: string;
    occurred_at: string;
  },
) {
  if (payload.id) {
    const { error } = await supabase.from("expenses").update(payload).eq("id", payload.id);
    if (error) throw new Error(error.message);
    return payload.id;
  }

  const { data, error } = await supabase.from("expenses").insert(payload).select("id").single();
  if (error) throw new Error(error.message);
  return data.id;
}

export async function adminDeleteExpense(id: string) {
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function adminListOrders(status = "all") {
  let query = supabase
    .from("orders")
    .select("id, order_number, full_name, city, phone, total_price, status, created_at, shipped_at, same_day")
    .order("created_at", { ascending: false })
    .limit(500);

  if (status !== "all") query = query.eq("status", status as OrderStatus);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function adminGetOrder(id: string) {
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("*")
    .eq("id", id)
    .single();
  if (orderError) throw new Error(orderError.message);

  const { data: items, error: itemsError } = await supabase
    .from("order_items")
    .select("*, images(storage_path, status)")
    .eq("order_id", id);
  if (itemsError) throw new Error(itemsError.message);

  const { data: images, error: imagesError } = await supabase
    .from("images")
    .select("*")
    .eq("order_id", id)
    .order("uploaded_at", { ascending: true });
  if (imagesError) throw new Error(imagesError.message);

  const activePaths = (images ?? []).filter((image) => image.status === "active").map((image) => image.storage_path);
  const signedUrls: Record<string, string> = {};

  if (activePaths.length) {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(activePaths, 3600);
    if (error) throw new Error(error.message);
    for (const item of data ?? []) {
      if (item.path && item.signedUrl) signedUrls[item.path] = item.signedUrl;
    }
  }

  return { order, items: items ?? [], images: images ?? [], signedUrls };
}

export async function adminUpdateOrderStatus(id: string, status: OrderStatus) {
  const { error } = await supabase.from("orders").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function adminUpdateOrder(
  id: string,
  payload: Pick<OrderRow, "full_name" | "phone" | "email" | "address" | "city" | "postal_code" | "notes">,
) {
  const { error } = await supabase.from("orders").update(payload).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function adminDeleteImage(id: string) {
  const { data, error } = await supabase.from("images").select("storage_path").eq("id", id).single();
  if (error) throw new Error(error.message);

  if (data.storage_path) {
    const { error: storageError } = await supabase.storage.from(BUCKET).remove([data.storage_path]);
    if (storageError) throw new Error(storageError.message);
  }

  const { error: updateError } = await supabase
    .from("images")
    .update({ status: "deleted" })
    .eq("id", id);
  if (updateError) throw new Error(updateError.message);
}

export async function adminDashboardStats() {
  const { data: orders, error } = await supabase
    .from("orders")
    .select("status, total_price, shipping_fee, created_at");
  if (error) throw new Error(error.message);

  const { data: expenses, error: expensesError } = await supabase.from("expenses").select("amount_km");
  if (expensesError) throw new Error(expensesError.message);

  const rows = orders ?? [];
  const net = (row: Pick<OrderRow, "total_price" | "shipping_fee">) =>
    Number(row.total_price) - Number(row.shipping_fee ?? 0);
  const completedRows = rows.filter((row) => row.status === "completed");
  const pendingRows = rows.filter((row) => !["cancelled", "completed"].includes(row.status));
  const revenue = completedRows.reduce((sum, row) => sum + net(row), 0);
  const pendingRevenue = pendingRows.reduce((sum, row) => sum + net(row), 0);
  const expensesTotal = (expenses ?? []).reduce((sum, row) => sum + Number(row.amount_km), 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const daily: Array<{ date: string; orders: number; revenue: number }> = [];
  for (let i = 29; i >= 0; i -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    daily.push({ date: date.toISOString().slice(0, 10), orders: 0, revenue: 0 });
  }
  const dailyMap = new Map(daily.map((entry) => [entry.date, entry]));

  for (const row of rows) {
    const key = new Date(row.created_at).toISOString().slice(0, 10);
    const bucket = dailyMap.get(key);
    if (!bucket) continue;
    bucket.orders += 1;
    if (row.status === "completed") bucket.revenue += net(row);
  }

  const monthly: Array<{ month: string; orders: number; revenue: number }> = [];
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  for (let i = 11; i >= 0; i -= 1) {
    const date = new Date(firstOfMonth);
    date.setMonth(firstOfMonth.getMonth() - i);
    monthly.push({
      month: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
      orders: 0,
      revenue: 0,
    });
  }
  const monthlyMap = new Map(monthly.map((entry) => [entry.month, entry]));

  for (const row of rows) {
    const date = new Date(row.created_at);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const bucket = monthlyMap.get(key);
    if (!bucket) continue;
    bucket.orders += 1;
    if (row.status === "completed") bucket.revenue += net(row);
  }

  return {
    total: rows.length,
    pending: rows.filter((row) => row.status === "pending").length,
    inProgress: rows.filter((row) => row.status === "in_progress").length,
    shipped: rows.filter((row) => row.status === "shipped").length,
    completed: completedRows.length,
    revenue,
    pendingRevenue,
    expenses: expensesTotal,
    profit: revenue - expensesTotal,
    daily,
    monthly,
  };
}

export async function adminRecentOrders() {
  const { data, error } = await supabase
    .from("orders")
    .select("id, order_number, full_name, city, total_price, status, created_at")
    .order("created_at", { ascending: false })
    .limit(8);

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function adminReports(month?: string) {
  const { data: ordersAll, error } = await supabase
    .from("orders")
    .select("id, status, total_price, shipping_fee, city, created_at");
  if (error) throw new Error(error.message);

  const { data: itemsAll, error: itemsError } = await supabase
    .from("order_items")
    .select("order_id, format_name, quantity, total_price");
  if (itemsError) throw new Error(itemsError.message);

  const { data: expensesAll, error: expensesError } = await supabase
    .from("expenses")
    .select("amount_km, category, occurred_at");
  if (expensesError) throw new Error(expensesError.message);

  const availableMonths = [
    ...new Set(
      (ordersAll ?? []).map((order) => {
        const date = new Date(order.created_at);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      }),
    ),
  ].sort().reverse();

  let orders = ordersAll ?? [];
  let items = itemsAll ?? [];
  let expenses = expensesAll ?? [];

  if (month) {
    const [year, monthNumber] = month.split("-").map(Number);
    const start = new Date(year, monthNumber - 1, 1).getTime();
    const end = new Date(year, monthNumber, 1).getTime();
    const inMonth = (value: string) => {
      const time = new Date(value).getTime();
      return time >= start && time < end;
    };

    orders = orders.filter((order) => inMonth(order.created_at));
    const orderIds = new Set(orders.map((order) => order.id));
    items = items.filter((item) => orderIds.has(item.order_id));
    expenses = expenses.filter((expense) => inMonth(expense.occurred_at));
  }

  const net = (row: Pick<OrderRow, "total_price" | "shipping_fee">) =>
    Number(row.total_price) - Number(row.shipping_fee ?? 0);
  const completed = orders.filter((order) => order.status === "completed");
  const cancelled = orders.filter((order) => order.status === "cancelled");

  const now = new Date();
  const startThis = new Date(now.getFullYear(), now.getMonth(), 1);
  const startLast = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endLast = startThis;
  const inRange = (value: string, from: Date, to: Date) => {
    const time = new Date(value).getTime();
    return time >= from.getTime() && time < to.getTime();
  };

  const thisMonthOrders = orders.filter((order) =>
    inRange(order.created_at, startThis, new Date(now.getFullYear(), now.getMonth() + 1, 1)),
  );
  const lastMonthOrders = orders.filter((order) => inRange(order.created_at, startLast, endLast));
  const thisMonthRevenue = thisMonthOrders
    .filter((order) => order.status === "completed")
    .reduce((sum, row) => sum + net(row), 0);
  const lastMonthRevenue = lastMonthOrders
    .filter((order) => order.status === "completed")
    .reduce((sum, row) => sum + net(row), 0);

  const cityMap = new Map<string, { city: string; orders: number; revenue: number }>();
  for (const order of orders) {
    const key = (order.city || "—").trim();
    const entry = cityMap.get(key) ?? { city: key, orders: 0, revenue: 0 };
    entry.orders += 1;
    if (order.status === "completed") entry.revenue += net(order);
    cityMap.set(key, entry);
  }

  const topCities = [...cityMap.values()].sort((a, b) => b.orders - a.orders).slice(0, 8);

  const formatMap = new Map<string, { name: string; quantity: number; revenue: number }>();
  for (const item of items) {
    const key = item.format_name;
    const entry = formatMap.get(key) ?? { name: key, quantity: 0, revenue: 0 };
    entry.quantity += Number(item.quantity);
    entry.revenue += Number(item.total_price);
    formatMap.set(key, entry);
  }

  const topFormats = [...formatMap.values()]
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 8);

  const expenseMap = new Map<string, number>();
  for (const expense of expenses) {
    expenseMap.set(expense.category, (expenseMap.get(expense.category) ?? 0) + Number(expense.amount_km));
  }

  const expenseByCategory = [...expenseMap.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

  const statusDist: Record<string, number> = {};
  for (const order of orders) statusDist[order.status] = (statusDist[order.status] ?? 0) + 1;

  const totalRevenue = completed.reduce((sum, row) => sum + net(row), 0);
  const totalExpenses = expenses.reduce((sum, row) => sum + Number(row.amount_km), 0);

  return {
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
    thisMonth: {
      orders: thisMonthOrders.length,
      revenue: thisMonthRevenue,
    },
    lastMonth: {
      orders: lastMonthOrders.length,
      revenue: lastMonthRevenue,
    },
    topCities,
    topFormats,
    expenseByCategory,
    statusDist,
    availableMonths,
    month: month ?? null,
  };
}