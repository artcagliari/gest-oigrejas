-- Comunhão v3: Kids por culto, departamentos e presença de ensino.
-- Execute no SQL Editor depois de schema.sql e migration_v2.sql.

do $$ begin
  create type public.child_authorization_decision as enum ('pending', 'authorized', 'denied', 'revoked');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.attendance_status as enum ('present', 'absent', 'justified', 'visitor');
exception when duplicate_object then null; end $$;

alter table public.events add column if not exists event_type text not null default 'general';
alter table public.events add column if not exists image_consent_required boolean not null default false;
alter table public.events add column if not exists checkin_open_at timestamptz;
alter table public.events add column if not exists checkin_closed_at timestamptz;

create table if not exists public.child_profiles (
  person_id uuid primary key references public.people(id) on delete cascade,
  church_id uuid not null references public.churches(id) on delete cascade,
  allergies text,
  medical_notes text,
  special_needs text,
  emergency_contact_name text,
  emergency_contact_phone text,
  authorized_pickup_people jsonb not null default '[]'::jsonb,
  pickup_code_required boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.child_guardians (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  child_id uuid not null references public.child_profiles(person_id) on delete cascade,
  guardian_person_id uuid not null references public.people(id) on delete cascade,
  relationship text not null,
  legal_guardian boolean not null default false,
  primary_contact boolean not null default false,
  can_pickup boolean not null default true,
  created_at timestamptz not null default now(),
  unique (child_id, guardian_person_id)
);

create table if not exists public.child_service_authorizations (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  child_id uuid not null references public.child_profiles(person_id) on delete cascade,
  guardian_id uuid references public.people(id) on delete set null,
  decision public.child_authorization_decision not null default 'pending',
  allow_photo boolean not null default false,
  allow_video boolean not null default false,
  allow_social_media boolean not null default false,
  consent_version text not null default 'kids-image-v1',
  consent_text_snapshot text not null,
  signed_name text,
  signed_at timestamptz,
  revoked_at timestamptz,
  token uuid not null default gen_random_uuid() unique,
  generated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, child_id)
);

create table if not exists public.child_authorization_audit (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  authorization_id uuid not null references public.child_service_authorizations(id) on delete cascade,
  action text not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  evidence jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create table if not exists public.child_checkins (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  child_id uuid not null references public.child_profiles(person_id) on delete cascade,
  guardian_id uuid references public.people(id) on delete set null,
  authorization_id uuid references public.child_service_authorizations(id) on delete set null,
  checkin_at timestamptz not null default now(),
  checkout_at timestamptz,
  pickup_by text,
  pickup_code text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  unique (event_id, child_id)
);

create index if not exists child_authorizations_event_idx on public.child_service_authorizations(event_id, decision);
create index if not exists child_checkins_event_idx on public.child_checkins(event_id, checkin_at);

create or replace function public.kids_consent_text(event_title text, event_date timestamptz)
returns text language sql immutable
as $$
  select 'Autorização específica para captação e uso de imagem da criança durante o evento "' ||
    coalesce(event_title, 'Culto') || '", realizado em ' ||
    to_char(event_date at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') ||
    '. O responsável pode autorizar separadamente fotografia, vídeo e publicação nas redes sociais da igreja. A recusa não impede a participação da criança. A autorização pode ser revogada, sem afetar usos realizados de forma legítima antes da revogação.'
$$;

create or replace function public.generate_kids_authorizations_for_event(target_event uuid)
returns integer language plpgsql security definer set search_path = public
as $$
declare inserted_count integer;
begin
  if auth.uid() is not null and not exists (
    select 1 from public.events e
    where e.id = target_event
      and public.has_church_role(e.church_id, array['super','people','agenda']::public.platform_role[])
  ) then
    raise exception 'Sem permissão para gerar autorizações deste culto';
  end if;
  insert into public.child_service_authorizations (
    church_id, event_id, child_id, guardian_id, consent_text_snapshot
  )
  select e.church_id, e.id, cp.person_id,
    (select cg.guardian_person_id from public.child_guardians cg
      where cg.child_id = cp.person_id and cg.legal_guardian
      order by cg.primary_contact desc, cg.created_at asc limit 1),
    public.kids_consent_text(e.title, e.starts_at)
  from public.events e
  join public.child_profiles cp on cp.church_id = e.church_id and cp.active
  where e.id = target_event and e.event_type = 'worship' and e.image_consent_required
  on conflict (event_id, child_id) do nothing;
  get diagnostics inserted_count = row_count;
  return inserted_count;
end $$;

revoke all on function public.generate_kids_authorizations_for_event(uuid) from public, anon;
grant execute on function public.generate_kids_authorizations_for_event(uuid) to authenticated;

create or replace function public.auto_generate_kids_authorizations()
returns trigger language plpgsql security definer set search_path = public
as $$ begin
  if new.event_type = 'worship' and new.image_consent_required then
    perform public.generate_kids_authorizations_for_event(new.id);
  end if;
  return new;
end $$;

drop trigger if exists generate_kids_authorizations_after_event on public.events;
create trigger generate_kids_authorizations_after_event
after insert or update of event_type, image_consent_required on public.events
for each row execute procedure public.auto_generate_kids_authorizations();

create or replace function public.auto_generate_authorizations_for_child()
returns trigger language plpgsql security definer set search_path = public
as $$ begin
  insert into public.child_service_authorizations (
    church_id, event_id, child_id, guardian_id, consent_text_snapshot
  )
  select e.church_id, e.id, new.person_id,
    (select cg.guardian_person_id from public.child_guardians cg
      where cg.child_id = new.person_id and cg.legal_guardian
      order by cg.primary_contact desc, cg.created_at asc limit 1),
    public.kids_consent_text(e.title, e.starts_at)
  from public.events e
  where e.church_id = new.church_id and e.event_type = 'worship'
    and e.image_consent_required and e.starts_at >= now()
  on conflict (event_id, child_id) do nothing;
  return new;
end $$;

drop trigger if exists generate_authorizations_after_child on public.child_profiles;
create trigger generate_authorizations_after_child
after insert or update of active on public.child_profiles
for each row when (new.active) execute procedure public.auto_generate_authorizations_for_child();

create or replace function public.audit_child_authorization_change()
returns trigger language plpgsql security definer set search_path = public
as $$ begin
  if tg_op = 'INSERT' then
    insert into public.child_authorization_audit(church_id, authorization_id, action, actor_user_id)
    values (new.church_id, new.id, 'generated', auth.uid());
  elsif old.decision is distinct from new.decision
     or old.allow_photo is distinct from new.allow_photo
     or old.allow_video is distinct from new.allow_video
     or old.allow_social_media is distinct from new.allow_social_media then
    insert into public.child_authorization_audit(church_id, authorization_id, action, actor_user_id, evidence)
    values (new.church_id, new.id, new.decision::text, auth.uid(), jsonb_build_object(
      'allow_photo', new.allow_photo,
      'allow_video', new.allow_video,
      'allow_social_media', new.allow_social_media,
      'signed_name', new.signed_name
    ));
  end if;
  return new;
end $$;

drop trigger if exists audit_child_authorization on public.child_service_authorizations;
create trigger audit_child_authorization
after insert or update on public.child_service_authorizations
for each row execute procedure public.audit_child_authorization_change();

create or replace function public.get_child_authorization_by_token(auth_token uuid)
returns table (
  authorization_id uuid, church_name text, event_title text, event_starts_at timestamptz,
  child_name text, decision public.child_authorization_decision,
  allow_photo boolean, allow_video boolean, allow_social_media boolean,
  consent_text text, signed_name text, signed_at timestamptz
) language sql stable security definer set search_path = public
as $$
  select a.id, c.name, e.title, e.starts_at, p.full_name, a.decision,
    a.allow_photo, a.allow_video, a.allow_social_media,
    a.consent_text_snapshot, a.signed_name, a.signed_at
  from public.child_service_authorizations a
  join public.churches c on c.id = a.church_id
  join public.events e on e.id = a.event_id
  join public.people p on p.id = a.child_id
  where a.token = auth_token
$$;

create or replace function public.respond_child_authorization(
  auth_token uuid,
  response_decision public.child_authorization_decision,
  response_photo boolean,
  response_video boolean,
  response_social_media boolean,
  response_signed_name text
) returns boolean language plpgsql security definer set search_path = public
as $$ begin
  if response_decision not in ('authorized', 'denied') then
    raise exception 'Decisão inválida';
  end if;
  if length(trim(coalesce(response_signed_name, ''))) < 3 then
    raise exception 'Identificação do responsável obrigatória';
  end if;
  update public.child_service_authorizations
  set decision = response_decision,
      allow_photo = case when response_decision = 'authorized' then response_photo else false end,
      allow_video = case when response_decision = 'authorized' then response_video else false end,
      allow_social_media = case when response_decision = 'authorized' then response_social_media else false end,
      signed_name = trim(response_signed_name), signed_at = now(), revoked_at = null, updated_at = now()
  where token = auth_token;
  return found;
end $$;

revoke all on function public.get_child_authorization_by_token(uuid) from public;
revoke all on function public.respond_child_authorization(uuid, public.child_authorization_decision, boolean, boolean, boolean, text) from public;
grant execute on function public.get_child_authorization_by_token(uuid) to anon, authenticated;
grant execute on function public.respond_child_authorization(uuid, public.child_authorization_decision, boolean, boolean, boolean, text) to anon, authenticated;

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  name text not null,
  department_type text not null default 'custom',
  description text,
  image_url text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.department_roles (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  department_id uuid not null references public.departments(id) on delete cascade,
  title text not null,
  sort_order integer not null default 0,
  unique(department_id, title)
);

create table if not exists public.department_members (
  church_id uuid not null references public.churches(id) on delete cascade,
  department_id uuid not null references public.departments(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  role_id uuid references public.department_roles(id) on delete set null,
  joined_at date not null default current_date,
  active boolean not null default true,
  primary key(department_id, person_id)
);

create table if not exists public.teaching_meetings (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  group_id uuid not null references public.teaching_groups(id) on delete cascade,
  title text not null,
  meeting_date timestamptz not null,
  lesson text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.teaching_attendance (
  church_id uuid not null references public.churches(id) on delete cascade,
  meeting_id uuid not null references public.teaching_meetings(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  status public.attendance_status not null default 'present',
  notes text,
  marked_at timestamptz not null default now(),
  marked_by uuid references auth.users(id) on delete set null,
  primary key(meeting_id, person_id)
);

alter table public.child_profiles enable row level security;
alter table public.child_guardians enable row level security;
alter table public.child_service_authorizations enable row level security;
alter table public.child_authorization_audit enable row level security;
alter table public.child_checkins enable row level security;
alter table public.departments enable row level security;
alter table public.department_roles enable row level security;
alter table public.department_members enable row level security;
alter table public.teaching_meetings enable row level security;
alter table public.teaching_attendance enable row level security;

drop policy if exists "read kids" on public.child_profiles;
create policy "read kids" on public.child_profiles for select using (public.has_church_access(church_id));
drop policy if exists "manage kids" on public.child_profiles;
create policy "manage kids" on public.child_profiles for all using (public.has_church_role(church_id, array['super','people']::public.platform_role[])) with check (public.has_church_role(church_id, array['super','people']::public.platform_role[]));

drop policy if exists "read guardians" on public.child_guardians;
create policy "read guardians" on public.child_guardians for select using (public.has_church_access(church_id));
drop policy if exists "manage guardians" on public.child_guardians;
create policy "manage guardians" on public.child_guardians for all using (public.has_church_role(church_id, array['super','people']::public.platform_role[])) with check (public.has_church_role(church_id, array['super','people']::public.platform_role[]));

drop policy if exists "read child authorizations" on public.child_service_authorizations;
create policy "read child authorizations" on public.child_service_authorizations for select using (public.has_church_access(church_id));
drop policy if exists "manage child authorizations" on public.child_service_authorizations;
create policy "manage child authorizations" on public.child_service_authorizations for all using (public.has_church_role(church_id, array['super','people','agenda']::public.platform_role[])) with check (public.has_church_role(church_id, array['super','people','agenda']::public.platform_role[]));

drop policy if exists "read authorization audit" on public.child_authorization_audit;
create policy "read authorization audit" on public.child_authorization_audit for select using (public.has_church_role(church_id, array['super','people']::public.platform_role[]));
drop policy if exists "read checkins" on public.child_checkins;
create policy "read checkins" on public.child_checkins for select using (public.has_church_access(church_id));
drop policy if exists "manage checkins" on public.child_checkins;
create policy "manage checkins" on public.child_checkins for all using (public.has_church_role(church_id, array['super','people','agenda']::public.platform_role[])) with check (public.has_church_role(church_id, array['super','people','agenda']::public.platform_role[]));

drop policy if exists "read departments" on public.departments;
create policy "read departments" on public.departments for select using (public.has_church_access(church_id));
drop policy if exists "manage departments" on public.departments;
create policy "manage departments" on public.departments for all using (public.has_church_role(church_id, array['super','people']::public.platform_role[])) with check (public.has_church_role(church_id, array['super','people']::public.platform_role[]));
drop policy if exists "read department roles" on public.department_roles;
create policy "read department roles" on public.department_roles for select using (public.has_church_access(church_id));
drop policy if exists "manage department roles" on public.department_roles;
create policy "manage department roles" on public.department_roles for all using (public.has_church_role(church_id, array['super','people']::public.platform_role[])) with check (public.has_church_role(church_id, array['super','people']::public.platform_role[]));
drop policy if exists "read department members" on public.department_members;
create policy "read department members" on public.department_members for select using (public.has_church_access(church_id));
drop policy if exists "manage department members" on public.department_members;
create policy "manage department members" on public.department_members for all using (public.has_church_role(church_id, array['super','people']::public.platform_role[])) with check (public.has_church_role(church_id, array['super','people']::public.platform_role[]));

drop policy if exists "read teaching meetings" on public.teaching_meetings;
create policy "read teaching meetings" on public.teaching_meetings for select using (public.has_church_access(church_id));
drop policy if exists "manage teaching meetings" on public.teaching_meetings;
create policy "manage teaching meetings" on public.teaching_meetings for all using (public.has_church_role(church_id, array['super','teaching']::public.platform_role[])) with check (public.has_church_role(church_id, array['super','teaching']::public.platform_role[]));
drop policy if exists "read teaching attendance" on public.teaching_attendance;
create policy "read teaching attendance" on public.teaching_attendance for select using (public.has_church_access(church_id));
drop policy if exists "manage teaching attendance" on public.teaching_attendance;
create policy "manage teaching attendance" on public.teaching_attendance for all using (public.has_church_role(church_id, array['super','teaching']::public.platform_role[])) with check (public.has_church_role(church_id, array['super','teaching']::public.platform_role[]));
