-- Separa definitivamente o Administrador da Plataforma dos dados das igrejas.
-- O Master administra igrejas, mas não herda acesso aos módulos operacionais.

create or replace function public.has_church_access(target_church uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.church_memberships m
    where m.church_id = target_church
      and m.user_id = auth.uid()
      and m.active
  )
$$;

create or replace function public.has_church_role(
  target_church uuid,
  allowed_roles public.platform_role[]
)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.church_memberships m
    where m.church_id = target_church
      and m.user_id = auth.uid()
      and m.active
      and m.role = any(allowed_roles)
  )
$$;

create or replace function public.shares_church(target_user uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.church_memberships mine
    join public.church_memberships theirs on theirs.church_id = mine.church_id
    where mine.user_id = auth.uid()
      and mine.active
      and theirs.user_id = target_user
      and theirs.active
  )
$$;

-- Remove vínculos operacionais de contas Master existentes.
delete from public.church_memberships membership
using auth.users account
where membership.user_id = account.id
  and account.raw_app_meta_data ->> 'platform_role' = 'master';

