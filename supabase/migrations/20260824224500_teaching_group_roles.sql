alter table public.teaching_group_members
  add column if not exists role_title text not null default 'Aluno(a)';

update public.teaching_group_members member
set role_title = 'Líder'
from public.teaching_groups teaching
where teaching.id = member.group_id and teaching.leader_id = member.person_id;

create or replace function public.save_teaching_group_team_v2(
  target_group uuid, target_church uuid, group_name text, group_track text,
  group_description text, group_leader uuid, group_weekday smallint,
  group_starts_at time, group_location text, group_capacity integer,
  member_assignments jsonb
) returns boolean language plpgsql security definer set search_path = public
as $$
declare group_exists boolean;
begin
  select exists(select 1 from public.teaching_groups where id = target_group and church_id = target_church) into group_exists;
  if group_exists then
    if not (public.has_church_role(target_church, array['super','teaching']::public.platform_role[]) or public.manages_teaching_group(target_group)) then
      raise exception using errcode = '42501', message = 'Sem permissão para gerenciar este grupo.';
    end if;
  elsif not public.has_church_role(target_church, array['super','teaching']::public.platform_role[]) then
    raise exception using errcode = '42501', message = 'Sem permissão para criar grupos.';
  end if;
  if not exists(select 1 from public.people where id = group_leader and church_id = target_church) then
    raise exception using errcode = '22023', message = 'Selecione um líder da igreja.';
  end if;

  insert into public.teaching_groups (id, church_id, name, track, description, leader_id, weekday, starts_at, location, capacity, active)
  values (target_group, target_church, trim(group_name), group_track, nullif(trim(group_description), ''), group_leader, group_weekday, group_starts_at, nullif(trim(group_location), ''), group_capacity, true)
  on conflict (id) do update set name = excluded.name, track = excluded.track, description = excluded.description,
    leader_id = excluded.leader_id, weekday = excluded.weekday, starts_at = excluded.starts_at,
    location = excluded.location, capacity = excluded.capacity;

  delete from public.teaching_group_members where group_id = target_group;
  insert into public.teaching_group_members (group_id, person_id, status, role_title)
  select target_group, person.id, 'active',
    case when person.id = group_leader then 'Líder' else coalesce(assignment.role_title, 'Aluno(a)') end
  from jsonb_to_recordset(coalesce(member_assignments, '[]'::jsonb)) as assignment(person_id uuid, role_title text)
  join public.people person on person.id = assignment.person_id and person.church_id = target_church
  union
  select target_group, group_leader, 'active', 'Líder'
  on conflict (group_id, person_id) do update set status = 'active', role_title = excluded.role_title;
  return true;
end;
$$;

revoke all on function public.save_teaching_group_team_v2(uuid, uuid, text, text, text, uuid, smallint, time, text, integer, jsonb) from public, anon;
grant execute on function public.save_teaching_group_team_v2(uuid, uuid, text, text, text, uuid, smallint, time, text, integer, jsonb) to authenticated;
