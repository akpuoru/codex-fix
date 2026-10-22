create policy "admins read profiles" on public.profiles for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "admins read roles" on public.user_roles for select to authenticated using (public.has_role(auth.uid(), 'admin'));

create or replace function public.admin_set_role(_user_id uuid, _make_admin boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'Forbidden: admin only'; end if;
  if _user_id = auth.uid() and not _make_admin then raise exception 'You cannot remove your own admin access'; end if;
  if _make_admin then
    insert into public.user_roles (user_id, role) values (_user_id, 'admin') on conflict do nothing;
  else
    delete from public.user_roles where user_id = _user_id and role = 'admin';
  end if;
end $$;
revoke all on function public.admin_set_role(uuid, boolean) from public, anon;
grant execute on function public.admin_set_role(uuid, boolean) to authenticated;