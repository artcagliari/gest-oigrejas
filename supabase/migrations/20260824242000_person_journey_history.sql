alter table public.people
  add column if not exists baptism_date date;

create table if not exists public.person_group_history (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  group_id uuid not null references public.teaching_groups(id) on delete cascade,
  group_name text not null,
  role_title text,
  action text not null check (action in ('joined', 'removed')),
  occurred_at timestamptz not null default now(),
  changed_by uuid references public.profiles(id) on delete set null
);

create index if not exists person_group_history_person_date_idx
  on public.person_group_history(person_id, occurred_at desc);

alter table public.person_group_history enable row level security;

drop policy if exists "church reads person group history" on public.person_group_history;
create policy "church reads person group history"
  on public.person_group_history for select
  using (public.has_church_access(church_id));

insert into public.person_group_history(
  church_id, person_id, group_id, group_name, role_title, action, occurred_at
)
select teaching.church_id, membership.person_id, teaching.id, teaching.name,
  membership.role_title, 'joined', coalesce(membership.joined_at::timestamptz, teaching.created_at)
from public.teaching_group_members membership
join public.teaching_groups teaching on teaching.id = membership.group_id
where not exists (
  select 1 from public.person_group_history history
  where history.person_id = membership.person_id
    and history.group_id = membership.group_id
    and history.action = 'joined'
);

do $$
declare
  function_sql text;
  marker text := '  delete from public.teaching_group_members where group_id = target_group;';
  history_sql text := $history$
  insert into public.person_group_history(church_id, person_id, group_id, group_name, role_title, action, changed_by)
  select target_church, existing.person_id, target_group, trim(group_name), existing.role_title, 'removed', auth.uid()
  from public.teaching_group_members existing
  where existing.group_id = target_group
    and existing.person_id <> group_leader
    and not exists (
      select 1 from jsonb_to_recordset(coalesce(member_assignments, '[]'::jsonb)) assignment(person_id uuid, role_title text)
      where assignment.person_id = existing.person_id
    );

  insert into public.person_group_history(church_id, person_id, group_id, group_name, role_title, action, changed_by)
  select target_church, candidate.person_id, target_group, trim(group_name), candidate.role_title, 'joined', auth.uid()
  from (
    select assignment.person_id,
      case when assignment.person_id = group_leader then 'Líder' else coalesce(assignment.role_title, 'Aluno(a)') end role_title
    from jsonb_to_recordset(coalesce(member_assignments, '[]'::jsonb)) assignment(person_id uuid, role_title text)
    union
    select group_leader, 'Líder'
  ) candidate
  where not exists (
    select 1 from public.teaching_group_members existing
    where existing.group_id = target_group and existing.person_id = candidate.person_id
  );

  delete from public.teaching_group_members where group_id = target_group;$history$;
begin
  select pg_get_functiondef(
    'public.save_teaching_group_team_v2(uuid,uuid,text,text,text,uuid,smallint,time without time zone,text,integer,jsonb)'::regprocedure
  ) into function_sql;
  if position(marker in function_sql) = 0 then
    raise exception 'Não foi possível habilitar o histórico de grupos.';
  end if;
  execute replace(function_sql, marker, history_sql);
end;
$$;

do $$
declare
  function_sql text;
begin
  select pg_get_functiondef(
    'public.submit_church_self_registration(uuid,jsonb)'::regprocedure
  ) into function_sql;

  function_sql := replace(function_sql,
    E'    or person_marital_status = ''\n    or registration_data->>''conversion_date'' is null\n    or not (registration_data ? ''baptized'') then',
    E'    or person_marital_status = '' then');
  function_sql := replace(function_sql,
    'Membro, Visitante ou Criança',
    'Membro, Visitante, Adolescente ou Criança');
  function_sql := replace(function_sql,
    '''Membro'', ''Visitante'', ''Criança''',
    '''Membro'', ''Visitante'', ''Adolescente'', ''Criança''');
  function_sql := replace(function_sql,
    'spouse_name, children_names, conversion_date, baptized, document_cpf,',
    'spouse_name, children_names, conversion_date, baptism_date, baptized, document_cpf,');
  function_sql := replace(function_sql,
    E'person_children, (registration_data->>''conversion_date'')::date,\n    (registration_data->>''baptized'')::boolean,',
    E'person_children, nullif(registration_data->>''conversion_date'', '''')::date,\n    nullif(registration_data->>''baptism_date'', '''')::date,\n    nullif(registration_data->>''baptism_date'', '''') is not null,');

  if position('baptism_date' in function_sql) = 0
    or position('Adolescente' in function_sql) = 0 then
    raise exception 'Não foi possível atualizar a jornada do pré-cadastro.';
  end if;
  execute function_sql;
end;
$$;

