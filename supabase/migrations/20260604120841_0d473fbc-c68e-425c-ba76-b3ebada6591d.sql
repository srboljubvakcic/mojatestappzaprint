
-- Storage RLS: anyone can upload, only admins can read/delete
create policy "Anyone upload to order-images"
  on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'order-images');

create policy "Admins read order-images"
  on storage.objects for select to authenticated
  using (bucket_id = 'order-images' and public.has_role(auth.uid(),'admin'));

create policy "Admins delete order-images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'order-images' and public.has_role(auth.uid(),'admin'));

-- Fix search_path warnings
alter function public.handle_order_status_change() set search_path = public;
alter function public.set_updated_at() set search_path = public;
alter function public.handle_new_user_role() set search_path = public;
