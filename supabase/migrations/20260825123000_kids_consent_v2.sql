-- Consentimento Kids v2: texto específico por culto e escopos obrigatórios.

alter table public.child_service_authorizations
  alter column consent_version set default 'kids-image-v2';

create or replace function public.kids_consent_text(event_title text, event_date timestamptz)
returns text
language sql
immutable
as $$
  select 'Declaro que recebi informações claras sobre a captação e o uso da imagem da criança ou adolescente no culto “' ||
    coalesce(event_title, 'Culto') || '”, previsto para ' ||
    to_char(event_date at time zone 'America/Sao_Paulo', 'DD/MM/YYYY às HH24:MI') ||
    '. A autorização é específica para este culto e poderá abranger, conforme as opções marcadas, fotografia, gravação em vídeo e publicação nos canais e redes sociais oficiais da igreja. A participação da criança ou adolescente não depende desta autorização. O consentimento poderá ser revogado mediante solicitação à igreja, preservados os tratamentos já realizados de forma legítima.'
$$;

create or replace function public.respond_child_authorization(
  auth_token uuid,
  response_decision public.child_authorization_decision,
  response_photo boolean,
  response_video boolean,
  response_social_media boolean,
  response_signed_name text
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if response_decision not in ('authorized', 'denied') then
    raise exception using errcode = '22023', message = 'Decisão inválida.';
  end if;
  if length(trim(coalesce(response_signed_name, ''))) < 3 then
    raise exception using errcode = '22023', message = 'Informe o nome completo do responsável legal.';
  end if;
  if response_decision = 'authorized'
    and not (response_photo or response_video or response_social_media) then
    raise exception using errcode = '22023', message = 'Selecione ao menos uma finalidade autorizada.';
  end if;

  update public.child_service_authorizations
  set decision = response_decision,
      allow_photo = case when response_decision = 'authorized' then response_photo else false end,
      allow_video = case when response_decision = 'authorized' then response_video else false end,
      allow_social_media = case when response_decision = 'authorized' then response_social_media else false end,
      signed_name = trim(response_signed_name),
      signed_at = now(),
      revoked_at = null,
      updated_at = now()
  where token = auth_token;

  if not found then
    raise exception using errcode = '22023', message = 'Autorização não encontrada ou link inválido.';
  end if;
  return true;
end
$$;

revoke all on function public.respond_child_authorization(uuid, public.child_authorization_decision, boolean, boolean, boolean, text) from public;
grant execute on function public.respond_child_authorization(uuid, public.child_authorization_decision, boolean, boolean, boolean, text) to anon, authenticated;

create or replace function public.validate_child_authorization_decision()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.decision in ('authorized', 'denied')
    and length(trim(coalesce(new.signed_name, ''))) < 3 then
    raise exception using errcode = '22023', message = 'Informe o nome completo do responsável legal.';
  end if;
  if new.decision = 'authorized'
    and not (new.allow_photo or new.allow_video or new.allow_social_media) then
    raise exception using errcode = '22023', message = 'Selecione ao menos uma finalidade autorizada.';
  end if;
  if new.decision in ('pending', 'denied', 'revoked') then
    new.allow_photo := false;
    new.allow_video := false;
    new.allow_social_media := false;
  end if;
  return new;
end
$$;

drop trigger if exists validate_child_authorization_decision
  on public.child_service_authorizations;
create trigger validate_child_authorization_decision
before insert or update on public.child_service_authorizations
for each row execute function public.validate_child_authorization_decision();
