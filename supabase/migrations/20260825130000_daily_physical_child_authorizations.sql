-- Confirmação do termo físico diário; o arquivo assinado permanece em papel.

create table if not exists public.child_daily_authorizations (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  child_id uuid not null references public.child_profiles(person_id) on delete cascade,
  authorization_date date not null default current_date,
  decision text not null check (decision in ('authorized', 'denied')),
  allow_photo boolean not null default false,
  allow_video boolean not null default false,
  allow_social_media boolean not null default false,
  signed_name text not null,
  confirmed_at timestamptz not null default now(),
  confirmed_by uuid references auth.users(id) on delete set null default auth.uid(),
  unique (child_id, authorization_date),
  check (length(trim(signed_name)) >= 3),
  check (
    (decision = 'authorized' and (allow_photo or allow_video or allow_social_media))
    or
    (decision = 'denied' and not allow_photo and not allow_video and not allow_social_media)
  )
);

create index if not exists child_daily_authorizations_church_date_idx
  on public.child_daily_authorizations(church_id, authorization_date desc);

alter table public.child_daily_authorizations enable row level security;

drop policy if exists "read daily child authorizations"
  on public.child_daily_authorizations;
create policy "read daily child authorizations"
  on public.child_daily_authorizations for select
  using (public.has_church_access(church_id));

drop policy if exists "manage daily child authorizations"
  on public.child_daily_authorizations;
create policy "manage daily child authorizations"
  on public.child_daily_authorizations for all
  using (
    public.has_church_role(
      church_id,
      array['super','people','agenda']::public.platform_role[]
    )
  )
  with check (
    public.has_church_role(
      church_id,
      array['super','people','agenda']::public.platform_role[]
    )
  );
