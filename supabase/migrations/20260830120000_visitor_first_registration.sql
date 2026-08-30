-- Coloca o tipo de vínculo no início do cadastro e permite o cadastro
-- simplificado de visitantes (nome, telefone e consentimentos).

alter function public.submit_church_self_registration(uuid, jsonb)
  rename to submit_church_self_registration_full_v2;

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
  visitor_id uuid;
  visitor_child_id uuid;
  visitor_child jsonb;
  visitor_name text := trim(coalesce(registration_data->>'full_name', ''));
  visitor_phone text := nullif(trim(coalesce(registration_data->>'phone_primary', '')), '');
  normalized_phone text := regexp_replace(coalesce(registration_data->>'phone_primary', ''), '[^0-9]', '', 'g');
  is_visitor boolean := coalesce(registration_data->'categories', '[]'::jsonb) @> '["Visitante"]'::jsonb;
  visitor_children_names text[] := '{}';
begin
  if not is_visitor then
    return public.submit_church_self_registration_full_v2(
      registration_token,
      registration_data
    );
  end if;

  select link.church_id into target_church
  from public.church_registration_links link
  join public.churches church on church.id = link.church_id and church.active
  where link.token = registration_token
    and link.active
    and (link.expires_at is null or link.expires_at > now());

  if target_church is null then
    raise exception using errcode = '22023', message = 'Link de cadastro inválido ou expirado.';
  end if;
  if char_length(visitor_name) < 3 or char_length(visitor_name) > 160 then
    raise exception using errcode = '22023', message = 'Informe o nome completo.';
  end if;
  if char_length(normalized_phone) < 10 then
    raise exception using errcode = '22023', message = 'Informe um telefone WhatsApp válido.';
  end if;
  if coalesce((registration_data->>'data_processing_consent')::boolean, false) is not true then
    raise exception using errcode = '22023', message = 'Autorize o tratamento dos dados pessoais para enviar o cadastro.';
  end if;
  if exists (
    select 1
    from public.people person
    where person.church_id = target_church
      and regexp_replace(coalesce(person.phone_primary, ''), '[^0-9]', '', 'g') = normalized_phone
  ) then
    raise exception using errcode = '23505', message = 'Já existe uma pessoa com este telefone nesta igreja.';
  end if;

  insert into public.people (
    church_id, full_name, phone_primary, address, categories,
    ministry_roles, notes, active
  ) values (
    target_church, visitor_name, visitor_phone, '{}'::jsonb,
    array['Pré-cadastro', 'Visitante'], '{}',
    'Cadastro simplificado de visitante realizado pelo link público da igreja.', true
  ) returning id into visitor_id;

  insert into public.people_consents (
    person_id, church_id, messaging, data_processing, consented_at
  ) values (
    visitor_id, target_church,
    coalesce((registration_data->>'messaging_consent')::boolean, false),
    true, now()
  );

  -- Mantém a regra mesmo para clientes antigos que ainda enviem filhos:
  -- filhos de visitante também entram como visitantes, nunca como membros/Kids.
  for visitor_child in
    select value
    from jsonb_array_elements(coalesce(registration_data->'children', '[]'::jsonb))
  loop
    if char_length(trim(coalesce(visitor_child->>'full_name', ''))) < 3 then
      raise exception using errcode = '22023', message = 'Informe o nome completo de cada filho.';
    end if;
    visitor_children_names := array_append(
      visitor_children_names,
      trim(visitor_child->>'full_name')
    );

    insert into public.people (
      church_id, full_name, birth_date, gender, document_cpf, address,
      categories, ministry_roles, notes, active
    ) values (
      target_church,
      trim(visitor_child->>'full_name'),
      nullif(visitor_child->>'birth_date', '')::date,
      nullif(visitor_child->>'gender', ''),
      nullif(trim(coalesce(visitor_child->>'document_cpf', '')), ''),
      '{}'::jsonb,
      array['Pré-cadastro', 'Visitante'], '{}',
      'Filho de visitante cadastrado como visitante.', true
    ) returning id into visitor_child_id;

    insert into public.people_consents (
      person_id, church_id, messaging, data_processing, consented_at
    ) values (
      visitor_child_id, target_church,
      coalesce((registration_data->>'messaging_consent')::boolean, false),
      true, now()
    );
  end loop;

  update public.people
  set children_names = visitor_children_names,
      updated_at = now()
  where id = visitor_id;

  return visitor_id;
end;
$$;

revoke all on function public.submit_church_self_registration_full_v2(uuid, jsonb) from public, anon;
revoke all on function public.submit_church_self_registration(uuid, jsonb) from public;
grant execute on function public.submit_church_self_registration(uuid, jsonb) to anon, authenticated;
