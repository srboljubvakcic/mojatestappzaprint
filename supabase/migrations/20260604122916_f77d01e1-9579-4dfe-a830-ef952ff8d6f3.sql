
-- 1) Order number sequence
create sequence if not exists public.orders_number_seq start 1001;
alter table public.orders add column if not exists order_number bigint;
update public.orders set order_number = nextval('public.orders_number_seq') where order_number is null;
alter table public.orders alter column order_number set default nextval('public.orders_number_seq');
alter table public.orders alter column order_number set not null;
create unique index if not exists orders_order_number_uq on public.orders(order_number);

-- 2) Fix format delete: cascade nullify
alter table public.order_items drop constraint if exists order_items_format_id_fkey;
alter table public.order_items
  add constraint order_items_format_id_fkey
  foreign key (format_id) references public.formats(id) on delete set null;

-- 3) Format categories
alter table public.formats add column if not exists category text not null default 'print';
alter table public.formats add constraint formats_category_chk
  check (category in ('print','album','gift'));

-- 4) Same-day + shipping fee on orders
alter table public.orders add column if not exists same_day boolean not null default false;
alter table public.orders add column if not exists same_day_fee numeric(10,2) not null default 0;
alter table public.orders add column if not exists shipping_fee numeric(10,2) not null default 0;

-- 5) App settings (singleton row id=1)
create table if not exists public.app_settings (
  id int primary key default 1,
  free_shipping_enabled boolean not null default true,
  free_shipping_threshold numeric(10,2) not null default 200,
  shipping_fee numeric(10,2) not null default 10,
  same_day_enabled boolean not null default false,
  same_day_price numeric(10,2) not null default 15,
  updated_at timestamptz not null default now(),
  constraint app_settings_singleton check (id = 1)
);
grant select on public.app_settings to anon, authenticated;
grant all on public.app_settings to service_role;
alter table public.app_settings enable row level security;
drop policy if exists "Anyone reads settings" on public.app_settings;
create policy "Anyone reads settings" on public.app_settings for select to anon, authenticated using (true);
drop policy if exists "Admins write settings" on public.app_settings;
create policy "Admins write settings" on public.app_settings for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
insert into public.app_settings (id) values (1) on conflict (id) do nothing;

create trigger app_settings_updated_at before update on public.app_settings
  for each row execute function public.set_updated_at();

-- 6) Expenses
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  amount_km numeric(10,2) not null check (amount_km >= 0),
  category text not null default 'other',
  occurred_at date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);
grant select on public.expenses to authenticated;
grant all on public.expenses to service_role;
alter table public.expenses enable row level security;
drop policy if exists "Admins manage expenses" on public.expenses;
create policy "Admins manage expenses" on public.expenses for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
