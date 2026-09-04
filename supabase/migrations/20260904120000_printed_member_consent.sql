-- Os consentimentos gerais passam a ser colhidos na ficha impressa.
-- Mantemos a função anterior isolada para preservar suas validações e a
-- criação transacional da família, mas não registramos aceite eletrônico.

alter function public.submit_church_self_registration(uuid, jsonb)
  rename to submit_church_self_registration_online_consent_v3;

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
  registered_person uuid;
  validated_data jsonb;
  informed_baptized boolean;
begin
  informed_baptized := case
    when registration_data ? 'baptized'
      then (registration_data->>'baptized')::boolean
    else null
  end;

  -- A implementação anterior exigia este campo. Ele é enviado apenas para
  -- atravessar a validação legada; os registros de consentimento são zerados
  -- imediatamente antes do fim da mesma transação.
  validated_data := registration_data || jsonb_build_object(
    'data_processing_consent', true,
    'messaging_consent', false,
    'baptism_date', case
      when informed_baptized is true then registration_data->>'baptism_date'
      else null
    end
  );

  registered_person := public.submit_church_self_registration_online_consent_v3(
    registration_token,
    validated_data
  );

  update public.people
  set baptized = informed_baptized,
      baptism_date = case
        when informed_baptized is true
          then nullif(registration_data->>'baptism_date', '')::date
        else null
      end,
      updated_at = now()
  where id = registered_person;

  update public.people_consents
  set messaging = false,
      representatives_contact = false,
      event_filming = false,
      event_photography = false,
      data_processing = false,
      social_media_image = false,
      marketing = false,
      consented_at = null,
      updated_at = now()
  where person_id = registered_person
     or person_id in (
       select guardian.child_id
       from public.child_guardians guardian
       where guardian.guardian_person_id = registered_person
     );

  return registered_person;
end;
$$;

revoke all on function public.submit_church_self_registration_online_consent_v3(uuid, jsonb)
  from public, anon, authenticated;
revoke all on function public.submit_church_self_registration_full_v2(uuid, jsonb)
  from public, anon, authenticated;
revoke all on function public.submit_church_self_registration(uuid, jsonb) from public;
grant execute on function public.submit_church_self_registration(uuid, jsonb)
  to anon, authenticated;
