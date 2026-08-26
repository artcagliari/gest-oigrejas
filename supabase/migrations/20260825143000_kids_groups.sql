-- Grupos do ministério Kids e seleção de crianças.

create table if not exists public.kids_groups (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  name text not null,
  description text,
  min_age integer check (min_age is null or min_age between 0 and 17),
  max_age integer check (max_age is null or max_age between 0 and 17),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (church_id, name),
  check (min_age is null or max_age is null or min_age <= max_age)
);

create table if not exists public.kids_group_members (
  church_id uuid not null references public.churches(id) on delete cascade,
  group_id uuid not null references public.kids_groups(id) on delete cascade,
  child_id uuid not null references public.child_profiles(person_id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, child_id)
);

create index if not exists kids_groups_church_name_idx
  on public.kids_groups(church_id, name);
create index if not exists kids_group_members_child_idx
  on public.kids_group_members(child_id);

alter table public.kids_groups enable row level security;
alter table public.kids_group_members enable row level security;

create policy "read kids groups" on public.kids_groups for select
  using (public.has_church_access(church_id));
create policy "manage kids groups" on public.kids_groups for all
  using (public.has_church_role(church_id, array['super','people']::public.platform_role[]))
  with check (public.has_church_role(church_id, array['super','people']::public.platform_role[]));
create policy "read kids group members" on public.kids_group_members for select
  using (public.has_church_access(church_id));
create policy "manage kids group members" on public.kids_group_members for all
  using (public.has_church_role(church_id, array['super','people']::public.platform_role[]))
  with check (public.has_church_role(church_id, array['super','people']::public.platform_role[]));

create or replace function public.save_kids_group(
  target_group uuid,
  target_church uuid,
  group_name text,
  group_description text,
  group_min_age integer,
  group_max_age integer,
  group_active boolean,
  group_children uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_church_role(
    target_church,
    array['super','people']::public.platform_role[]
  ) then
    raise exception using errcode = '42501', message = 'Sem permissão para gerenciar grupos Kids.';
  end if;
  if length(trim(coalesce(group_name, ''))) < 2 then
    raise exception using errcode = '22023', message = 'Informe o nome do grupo Kids.';
  end if;
  if group_min_age is not null and group_max_age is not null and group_min_age > group_max_age then
    raise exception using errcode = '22023', message = 'A idade inicial não pode ser maior que a final.';
  end if;
  if exists (
    select 1 from unnest(coalesce(group_children, '{}'::uuid[])) child
    where not exists (
      select 1 from public.child_profiles profile
      where profile.person_id = child
        and profile.church_id = target_church
        and profile.active
    )
  ) then
    raise exception using errcode = '22023', message = 'Uma criança selecionada não pertence a esta igreja.';
  end if;

  insert into public.kids_groups(
    id, church_id, name, description, min_age, max_age, active
  ) values (
    target_group, target_church, trim(group_name), group_description,
    group_min_age, group_max_age, coalesce(group_active, true)
  )
  on conflict (id) do update
  set name = excluded.name,
      description = excluded.description,
      min_age = excluded.min_age,
      max_age = excluded.max_age,
      active = excluded.active,
      updated_at = now();

  delete from public.kids_group_members where group_id = target_group;
  insert into public.kids_group_members(church_id, group_id, child_id)
  select target_church, target_group, child
  from unnest(coalesce(group_children, '{}'::uuid[])) child;
  return target_group;
end
$$;

revoke all on function public.save_kids_group(uuid, uuid, text, text, integer, integer, boolean, uuid[]) from public, anon;
grant execute on function public.save_kids_group(uuid, uuid, text, text, integer, integer, boolean, uuid[]) to authenticated;
