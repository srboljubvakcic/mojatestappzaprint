alter table public.user_roles force row level security;

create policy "No direct role inserts"
on public.user_roles
for insert
to authenticated
with check (false);

create policy "No direct role updates"
on public.user_roles
for update
to authenticated
using (false)
with check (false);

create policy "No direct role deletes"
on public.user_roles
for delete
to authenticated
using (false);