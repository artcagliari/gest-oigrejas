-- Comunhão: estrutura inicial multi-igreja para Supabase/Postgres.
-- Execute no SQL Editor de um projeto novo. O primeiro master deve receber
-- {"platform_role":"master"} em app_metadata pelo painel/servidor seguro.

create extension if not exists "pgcrypto";

create type public.platform_role as enum ('master', 'super', 'people', 'teaching', 'finance', 'agenda', 'viewer');
create type public.transaction_type as enum ('income', 'expense');
create type public.transaction_status as enum ('pending', 'paid', 'cancelled');

create table public.churches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  document text,
  email text,
  phone text,
  address jsonb not null default '{}'::jsonb,
  logo_url text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table public.church_memberships (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.platform_role not null default 'viewer',
  permissions text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (church_id, user_id)
);

create or replace function public.is_platform_master()
returns boolean language sql stable security definer set search_path = public
as $$ select coalesce(auth.jwt() -> 'app_metadata' ->> 'platform_role', '') = 'master' $$;

create or replace function public.has_church_access(target_church uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select public.is_platform_master() or exists (
    select 1 from public.church_memberships m
    where m.church_id = target_church and m.user_id = auth.uid() and m.active
  )
$$;

create or replace function public.has_church_role(target_church uuid, allowed_roles public.platform_role[])
returns boolean language sql stable security definer set search_path = public
as $$
  select public.is_platform_master() or exists (
    select 1 from public.church_memberships m
    where m.church_id = target_church and m.user_id = auth.uid()
      and m.active and m.role = any(allowed_roles)
  )
$$;

create table public.people (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  full_name text not null,
  preferred_name text,
  birth_date date,
  gender text,
  education text,
  marital_status text,
  spouse_name text,
  conversion_date date,
  baptized boolean,
  document_cpf text,
  document_rg text,
  email text,
  phone_primary text,
  phone_secondary text,
  address jsonb not null default '{}'::jsonb,
  categories text[] not null default '{}',
  ministry_roles text[] not null default '{}',
  notes text,
  avatar_url text,
  active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.people_consents (
  person_id uuid primary key references public.people(id) on delete cascade,
  church_id uuid not null references public.churches(id) on delete cascade,
  messaging boolean not null default false,
  representatives_contact boolean not null default false,
  event_filming boolean not null default false,
  event_photography boolean not null default false,
  data_processing boolean not null default false,
  social_media_image boolean not null default false,
  marketing boolean not null default false,
  consented_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.teaching_groups (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  name text not null,
  track text not null,
  description text,
  leader_id uuid references public.people(id) on delete set null,
  assistant_id uuid references public.people(id) on delete set null,
  weekday smallint check (weekday between 0 and 6),
  starts_at time,
  start_date date,
  end_date date,
  location text,
  capacity integer check (capacity is null or capacity > 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.teaching_group_members (
  group_id uuid references public.teaching_groups(id) on delete cascade,
  person_id uuid references public.people(id) on delete cascade,
  status text not null default 'active',
  joined_at date not null default current_date,
  completed_at date,
  primary key (group_id, person_id)
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  all_day boolean not null default false,
  location text,
  color text,
  recurrence_rule text,
  group_id uuid references public.teaching_groups(id) on delete set null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.financial_accounts (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  name text not null,
  opening_balance numeric(14,2) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.financial_categories (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  name text not null,
  type public.transaction_type not null,
  unique (church_id, name, type)
);

create table public.financial_transactions (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  account_id uuid references public.financial_accounts(id),
  category_id uuid references public.financial_categories(id),
  type public.transaction_type not null,
  status public.transaction_status not null default 'pending',
  description text not null,
  amount numeric(14,2) not null check (amount > 0),
  due_date date not null,
  paid_at timestamptz,
  person_id uuid references public.people(id) on delete set null,
  attachment_url text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index people_church_name_idx on public.people (church_id, full_name);
create index groups_church_active_idx on public.teaching_groups (church_id, active);
create index events_church_date_idx on public.events (church_id, starts_at);
create index transactions_church_due_idx on public.financial_transactions (church_id, due_date);

alter table public.churches enable row level security;
alter table public.profiles enable row level security;
alter table public.church_memberships enable row level security;
alter table public.people enable row level security;
alter table public.people_consents enable row level security;
alter table public.teaching_groups enable row level security;
alter table public.teaching_group_members enable row level security;
alter table public.events enable row level security;
alter table public.financial_accounts enable row level security;
alter table public.financial_categories enable row level security;
alter table public.financial_transactions enable row level security;

create policy "master manages churches" on public.churches for all using (public.is_platform_master()) with check (public.is_platform_master());
create policy "members view own church" on public.churches for select using (public.has_church_access(id));
create policy "users read own profile" on public.profiles for select using (id = auth.uid() or public.is_platform_master());
create policy "users update own profile" on public.profiles for update using (id = auth.uid());
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
create policy "team reads profiles" on public.profiles for select using (public.shares_church(id));
create policy "memberships visible to church" on public.church_memberships for select using (public.has_church_access(church_id));
create policy "admins manage memberships" on public.church_memberships for all
  using (public.has_church_role(church_id, array['super']::public.platform_role[]))
  with check (public.has_church_role(church_id, array['super']::public.platform_role[]));

-- Leitura isolada por igreja para membros ativos.
create policy "read church people" on public.people for select using (public.has_church_access(church_id));
create policy "read church consents" on public.people_consents for select using (public.has_church_access(church_id));
create policy "read church groups" on public.teaching_groups for select using (public.has_church_access(church_id));
create policy "read church group members" on public.teaching_group_members for select using (exists (select 1 from public.teaching_groups g where g.id = group_id and public.has_church_access(g.church_id)));
create policy "read church events" on public.events for select using (public.has_church_access(church_id));
create policy "read church accounts" on public.financial_accounts for select using (public.has_church_access(church_id));
create policy "read church categories" on public.financial_categories for select using (public.has_church_access(church_id));
create policy "read church transactions" on public.financial_transactions for select using (public.has_church_access(church_id));

-- Escrita limitada aos responsáveis do módulo e ao Gestor geral (super).
create policy "manage people" on public.people for all
  using (public.has_church_role(church_id, array['super','people','teaching']::public.platform_role[]))
  with check (public.has_church_role(church_id, array['super','people','teaching']::public.platform_role[]));
create policy "manage consents" on public.people_consents for all
  using (public.has_church_role(church_id, array['super','people']::public.platform_role[]))
  with check (public.has_church_role(church_id, array['super','people']::public.platform_role[]));
create policy "manage groups" on public.teaching_groups for all
  using (public.has_church_role(church_id, array['super','teaching']::public.platform_role[]))
  with check (public.has_church_role(church_id, array['super','teaching']::public.platform_role[]));
create policy "manage group members" on public.teaching_group_members for all
  using (exists (select 1 from public.teaching_groups g where g.id = group_id and public.has_church_role(g.church_id, array['super','teaching']::public.platform_role[])))
  with check (exists (select 1 from public.teaching_groups g where g.id = group_id and public.has_church_role(g.church_id, array['super','teaching']::public.platform_role[])));
create policy "manage events" on public.events for all
  using (public.has_church_role(church_id, array['super','agenda']::public.platform_role[]))
  with check (public.has_church_role(church_id, array['super','agenda']::public.platform_role[]));
create policy "manage accounts" on public.financial_accounts for all
  using (public.has_church_role(church_id, array['super','finance']::public.platform_role[]))
  with check (public.has_church_role(church_id, array['super','finance']::public.platform_role[]));
create policy "manage categories" on public.financial_categories for all
  using (public.has_church_role(church_id, array['super','finance']::public.platform_role[]))
  with check (public.has_church_role(church_id, array['super','finance']::public.platform_role[]));
create policy "manage transactions" on public.financial_transactions for all
  using (public.has_church_role(church_id, array['super','finance']::public.platform_role[]))
  with check (public.has_church_role(church_id, array['super','finance']::public.platform_role[]));

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$ begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)));
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();
