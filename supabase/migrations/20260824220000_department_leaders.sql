alter table public.people add column if not exists auth_user_id uuid references auth.users(id) on delete set null;
create unique index if not exists people_church_auth_user_unique on public.people(church_id, auth_user_id) where auth_user_id is not null;
alter table public.department_members add column if not exists can_manage boolean not null default false;

update public.people person set auth_user_id = account.id
from auth.users account
where person.auth_user_id is null and person.email is not null
  and lower(person.email) = lower(account.email)
  and 1 = (select count(*) from public.people duplicate where duplicate.church_id = person.church_id and lower(duplicate.email) = lower(person.email));

create or replace function public.manages_department(target_department uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.department_members member
    join public.people person on person.id = member.person_id
    where member.department_id = target_department and member.active
      and member.can_manage and person.auth_user_id = auth.uid()
  )
$$;

drop policy if exists "manage departments" on public.departments;
drop policy if exists "create departments" on public.departments;
drop policy if exists "update departments" on public.departments;
drop policy if exists "delete departments" on public.departments;
create policy "create departments" on public.departments for insert
  with check (public.has_church_role(church_id, array['super']::public.platform_role[]));
create policy "update departments" on public.departments for update
  using (public.has_church_role(church_id, array['super']::public.platform_role[]) or public.manages_department(id))
  with check (public.has_church_role(church_id, array['super']::public.platform_role[]) or public.manages_department(id));
create policy "delete departments" on public.departments for delete
  using (public.has_church_role(church_id, array['super']::public.platform_role[]));

drop policy if exists "manage department roles" on public.department_roles;
create policy "manage department roles" on public.department_roles for all
  using (public.has_church_role(church_id, array['super']::public.platform_role[]) or public.manages_department(department_id))
  with check (public.has_church_role(church_id, array['super']::public.platform_role[]) or public.manages_department(department_id));
drop policy if exists "manage department members" on public.department_members;
create policy "manage department members" on public.department_members for all
  using (public.has_church_role(church_id, array['super']::public.platform_role[]) or public.manages_department(department_id))
  with check (public.has_church_role(church_id, array['super']::public.platform_role[]) or public.manages_department(department_id));
grant execute on function public.manages_department(uuid) to authenticated;

create or replace function public.save_department_team(
  target_department uuid, target_church uuid, department_name text,
  department_type text, department_description text, role_titles text[],
  member_assignments jsonb
) returns boolean language plpgsql security definer set search_path = public
as $$
declare department_exists boolean;
begin
  select exists(select 1 from public.departments where id = target_department and church_id = target_church) into department_exists;
  if department_exists then
    if not (public.has_church_role(target_church, array['super']::public.platform_role[]) or public.manages_department(target_department)) then
      raise exception using errcode = '42501', message = 'Sem permissão para gerenciar este departamento.';
    end if;
  elsif not public.has_church_role(target_church, array['super']::public.platform_role[]) then
    raise exception using errcode = '42501', message = 'Somente o Gestor Geral pode criar departamentos.';
  end if;

  insert into public.departments (id, church_id, name, department_type, description, active)
  values (target_department, target_church, trim(department_name), department_type, nullif(trim(department_description), ''), true)
  on conflict (id) do update set name = excluded.name, department_type = excluded.department_type, description = excluded.description;

  delete from public.department_members where department_id = target_department;
  delete from public.department_roles where department_id = target_department;
  insert into public.department_roles (church_id, department_id, title, sort_order)
  select target_church, target_department, trim(role_title), ordinal::integer - 1
  from unnest(role_titles) with ordinality as listed(role_title, ordinal)
  where trim(role_title) <> '';
  insert into public.department_members (church_id, department_id, person_id, role_id, active, can_manage)
  select target_church, target_department, person.id, role.id, true, assignment.can_manage
  from jsonb_to_recordset(coalesce(member_assignments, '[]'::jsonb)) as assignment(person_id uuid, role_title text, can_manage boolean)
  join public.people person on person.id = assignment.person_id and person.church_id = target_church
  left join public.department_roles role on role.department_id = target_department and role.title = assignment.role_title;
  return true;
end;
$$;
revoke all on function public.save_department_team(uuid, uuid, text, text, text, text[], jsonb) from public, anon;
grant execute on function public.save_department_team(uuid, uuid, text, text, text, text[], jsonb) to authenticated;
