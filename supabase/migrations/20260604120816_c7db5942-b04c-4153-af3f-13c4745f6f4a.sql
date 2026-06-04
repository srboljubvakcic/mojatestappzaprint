
-- Enums
create type public.app_role as enum ('admin','user');
create type public.order_status as enum ('pending','in_progress','printed','shipped','completed','cancelled');

-- Roles
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique(user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "Admins read all roles" on public.user_roles for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- Auto-admin trigger for the designated email
create or replace function public.handle_new_user_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if NEW.email = 'srboljubvakcic@gmail.com' then
    insert into public.user_roles(user_id, role) values (NEW.id, 'admin')
      on conflict do nothing;
  end if;
  return NEW;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user_role();

-- Formats
create table public.formats (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price_km numeric(10,2) not null check (price_km >= 0),
  description text,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.formats to anon, authenticated;
grant all on public.formats to service_role;
alter table public.formats enable row level security;
create policy "Anyone reads active formats" on public.formats for select to anon, authenticated using (active = true);
create policy "Admins read all formats" on public.formats for select to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "Admins write formats" on public.formats for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- Orders
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null,
  email text,
  address text not null,
  city text not null,
  postal_code text,
  notes text,
  total_price numeric(10,2) not null default 0,
  status public.order_status not null default 'pending',
  created_at timestamptz not null default now(),
  shipped_at timestamptz
);
grant select, insert on public.orders to anon, authenticated;
grant all on public.orders to service_role;
alter table public.orders enable row level security;
create policy "Anyone can create order" on public.orders for insert to anon, authenticated with check (true);
create policy "Admins manage orders" on public.orders for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- Images
create table public.images (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  storage_path text not null,
  status text not null default 'active',
  uploaded_at timestamptz not null default now(),
  delete_after timestamptz
);
grant select, insert on public.images to anon, authenticated;
grant all on public.images to service_role;
alter table public.images enable row level security;
create policy "Anyone inserts image rows" on public.images for insert to anon, authenticated with check (true);
create policy "Admins manage images" on public.images for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create index images_delete_after_idx on public.images(delete_after) where status='active';

-- Order items
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  image_id uuid references public.images(id) on delete set null,
  format_id uuid references public.formats(id),
  format_name text not null,
  price_per_unit numeric(10,2) not null,
  quantity int not null check (quantity > 0),
  total_price numeric(10,2) not null
);
grant select, insert on public.order_items to anon, authenticated;
grant all on public.order_items to service_role;
alter table public.order_items enable row level security;
create policy "Anyone inserts items" on public.order_items for insert to anon, authenticated with check (true);
create policy "Admins manage items" on public.order_items for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- Trigger to set shipped_at and image deletion timer
create or replace function public.handle_order_status_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if NEW.status = 'shipped' and (OLD.status is distinct from 'shipped') then
    NEW.shipped_at := now();
    update public.images
      set delete_after = now() + interval '48 hours'
      where order_id = NEW.id and status = 'active';
  end if;
  return NEW;
end;
$$;
create trigger orders_status_change
  before update on public.orders
  for each row execute function public.handle_order_status_change();

-- updated_at on formats
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin NEW.updated_at = now(); return NEW; end;
$$;
create trigger formats_updated_at before update on public.formats
  for each row execute function public.set_updated_at();

-- Seed default formats
insert into public.formats (name, price_km, description, sort_order) values
  ('9x13 cm', 0.35, 'Standard mali format', 1),
  ('10x15 cm', 0.40, 'Najpopularniji format', 2),
  ('13x18 cm', 0.80, 'Srednji format', 3),
  ('15x21 cm', 1.20, 'Veći format', 4),
  ('20x30 cm', 3.50, 'Veliki print', 5),
  ('A4 (21x30 cm)', 4.00, 'A4 format', 6);
