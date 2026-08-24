-- Execute uma vez se o schema inicial já foi aplicado antes desta atualização.

create or replace function public.shares_church(target_user uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select public.is_platform_master() or exists (
    select 1 from public.church_memberships mine
    join public.church_memberships theirs on theirs.church_id = mine.church_id
    where mine.user_id = auth.uid() and mine.active
      and theirs.user_id = target_user and theirs.active
  )
$$;

drop policy if exists "team reads profiles" on public.profiles;
create policy "team reads profiles" on public.profiles
for select using (public.shares_church(id));
