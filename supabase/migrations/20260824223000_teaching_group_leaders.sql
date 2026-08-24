create or replace function public.manages_teaching_group(target_group uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.teaching_groups teaching
    join public.people leader on leader.id = teaching.leader_id
    where teaching.id = target_group and teaching.active
      and leader.auth_user_id = auth.uid()
  )
$$;

drop policy if exists "manage groups" on public.teaching_groups;
drop policy if exists "create teaching groups" on public.teaching_groups;
drop policy if exists "update teaching groups" on public.teaching_groups;
drop policy if exists "delete teaching groups" on public.teaching_groups;
create policy "create teaching groups" on public.teaching_groups for insert
  with check (public.has_church_role(church_id, array['super','teaching']::public.platform_role[]));
create policy "update teaching groups" on public.teaching_groups for update
  using (public.has_church_role(church_id, array['super','teaching']::public.platform_role[]) or public.manages_teaching_group(id))
  with check (public.has_church_role(church_id, array['super','teaching']::public.platform_role[]) or public.manages_teaching_group(id));
create policy "delete teaching groups" on public.teaching_groups for delete
  using (public.has_church_role(church_id, array['super','teaching']::public.platform_role[]));

drop policy if exists "manage group members" on public.teaching_group_members;
create policy "manage group members" on public.teaching_group_members for all
  using (public.manages_teaching_group(group_id) or exists (
    select 1 from public.teaching_groups teaching where teaching.id = group_id
      and public.has_church_role(teaching.church_id, array['super','teaching']::public.platform_role[])
  )) with check (public.manages_teaching_group(group_id) or exists (
    select 1 from public.teaching_groups teaching where teaching.id = group_id
      and public.has_church_role(teaching.church_id, array['super','teaching']::public.platform_role[])
  ));

drop policy if exists "manage teaching meetings" on public.teaching_meetings;
create policy "manage teaching meetings" on public.teaching_meetings for all
  using (public.has_church_role(church_id, array['super','teaching']::public.platform_role[]) or public.manages_teaching_group(group_id))
  with check (public.has_church_role(church_id, array['super','teaching']::public.platform_role[]) or public.manages_teaching_group(group_id));

drop policy if exists "manage teaching attendance" on public.teaching_attendance;
create policy "manage teaching attendance" on public.teaching_attendance for all
  using (public.has_church_role(church_id, array['super','teaching']::public.platform_role[]) or exists (
    select 1 from public.teaching_meetings meeting where meeting.id = meeting_id
      and public.manages_teaching_group(meeting.group_id)
  )) with check (public.has_church_role(church_id, array['super','teaching']::public.platform_role[]) or exists (
    select 1 from public.teaching_meetings meeting where meeting.id = meeting_id
      and public.manages_teaching_group(meeting.group_id)
  ));

create or replace function public.save_teaching_group_team(
  target_group uuid, target_church uuid, group_name text, group_track text,
  group_description text, group_leader uuid, group_weekday smallint,
  group_starts_at time, group_location text, group_capacity integer,
  member_ids uuid[]
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

  insert into public.teaching_groups (
    id, church_id, name, track, description, leader_id, weekday,
    starts_at, location, capacity, active
  ) values (
    target_group, target_church, trim(group_name), group_track,
    nullif(trim(group_description), ''), group_leader, group_weekday,
    group_starts_at, nullif(trim(group_location), ''), group_capacity, true
  ) on conflict (id) do update set
    name = excluded.name, track = excluded.track,
    description = excluded.description, leader_id = excluded.leader_id,
    weekday = excluded.weekday, starts_at = excluded.starts_at,
    location = excluded.location, capacity = excluded.capacity;

  delete from public.teaching_group_members where group_id = target_group;
  insert into public.teaching_group_members (group_id, person_id, status)
  select target_group, person.id, 'active'
  from public.people person
  where person.church_id = target_church
    and person.id = any(array_append(coalesce(member_ids, '{}'::uuid[]), group_leader))
  on conflict (group_id, person_id) do update set status = 'active';
  return true;
end;
$$;

revoke all on function public.save_teaching_group_team(uuid, uuid, text, text, text, uuid, smallint, time, text, integer, uuid[]) from public, anon;
grant execute on function public.save_teaching_group_team(uuid, uuid, text, text, text, uuid, smallint, time, text, integer, uuid[]) to authenticated;
grant execute on function public.manages_teaching_group(uuid) to authenticated;

