-- Reutiliza filhos pelo CPF entre responsáveis e classifica maiores como membros.

alter function public.submit_church_self_registration(uuid, jsonb)
  rename to submit_church_self_registration_family_v1;

create or replace function public.submit_church_self_registration(
  registration_token uuid,
  registration_data jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_church uuid;
  parent_id uuid;
  child_record jsonb;
  child_id uuid;
  child_cpf text;
  child_name text;
  child_birth date;
  child_age integer;
  new_children jsonb := '[]'::jsonb;
  all_children_names text[] := '{}';
  parent_name text := trim(coalesce(registration_data->>'full_name', ''));
  parent_phone text := nullif(trim(coalesce(registration_data->>'phone_primary', '')), '');
  parent_cpf text := nullif(trim(coalesce(registration_data->>'document_cpf', '')), '');
begin
  select link.church_id into target_church
  from public.church_registration_links link
  join public.churches church on church.id = link.church_id and church.active
  where link.token = registration_token
    and link.active
    and (link.expires_at is null or link.expires_at > now());

  if target_church is null then
    raise exception using errcode = '22023', message = 'Link de cadastro inválido ou expirado.';
  end if;

  for child_record in
    select value from jsonb_array_elements(coalesce(registration_data->'children', '[]'::jsonb))
  loop
    child_name := trim(coalesce(child_record->>'full_name', ''));
    child_cpf := regexp_replace(coalesce(child_record->>'document_cpf', ''), '[^0-9]', '', 'g');
    all_children_names := array_append(all_children_names, child_name);

    select person.id into child_id
    from public.people person
    where person.church_id = target_church
      and regexp_replace(coalesce(person.document_cpf, ''), '[^0-9]', '', 'g') = child_cpf
    order by person.created_at
    limit 1;

    if child_id is null then
      new_children := new_children || jsonb_build_array(child_record);
    end if;
  end loop;

  parent_id := public.submit_church_self_registration_family_v1(
    registration_token,
    jsonb_set(registration_data, '{children}', new_children, true)
  );

  update public.people
  set children_names = all_children_names,
      updated_at = now()
  where id = parent_id;

  for child_record in
    select value from jsonb_array_elements(coalesce(registration_data->'children', '[]'::jsonb))
  loop
    child_name := trim(child_record->>'full_name');
    child_cpf := regexp_replace(child_record->>'document_cpf', '[^0-9]', '', 'g');
    child_birth := (child_record->>'birth_date')::date;
    child_age := date_part('year', age(current_date, child_birth))::int;

    select person.id into child_id
    from public.people person
    where person.church_id = target_church
      and regexp_replace(coalesce(person.document_cpf, ''), '[^0-9]', '', 'g') = child_cpf
    order by person.created_at
    limit 1;

    update public.people
    set full_name = child_name,
        birth_date = child_birth,
        gender = child_record->>'gender',
        categories = case
          when child_age >= 18 then array['Membro']::text[]
          when child_age >= 12 then array['Criança', 'Adolescente']::text[]
          else array['Criança']::text[]
        end,
        updated_at = now()
    where id = child_id;

    if child_age < 18 then
      insert into public.child_profiles (
        person_id, church_id, emergency_contact_name, emergency_contact_phone,
        authorized_pickup_people, pickup_code_required, active
      ) values (
        child_id, target_church, parent_name, parent_phone,
        jsonb_build_array(jsonb_build_object('name', parent_name, 'document', parent_cpf)),
        true, true
      )
      on conflict (person_id) do update
      set authorized_pickup_people = case
            when child_profiles.authorized_pickup_people @>
              jsonb_build_array(jsonb_build_object('name', parent_name, 'document', parent_cpf))
            then child_profiles.authorized_pickup_people
            else child_profiles.authorized_pickup_people ||
              jsonb_build_array(jsonb_build_object('name', parent_name, 'document', parent_cpf))
          end,
          updated_at = now();

      insert into public.child_guardians (
        church_id, child_id, guardian_person_id, relationship,
        legal_guardian, primary_contact, can_pickup
      ) values (
        target_church, child_id, parent_id, 'Pai, mãe ou responsável',
        true,
        not exists (
          select 1 from public.child_guardians existing
          where existing.child_id = child_id and existing.primary_contact
        ),
        true
      )
      on conflict (child_id, guardian_person_id) do update
      set legal_guardian = true, can_pickup = true;
    end if;
  end loop;

  return parent_id;
end
$$;

revoke all on function public.submit_church_self_registration_family_v1(uuid, jsonb) from public, anon;
revoke all on function public.submit_church_self_registration(uuid, jsonb) from public;
grant execute on function public.submit_church_self_registration(uuid, jsonb) to anon, authenticated;
