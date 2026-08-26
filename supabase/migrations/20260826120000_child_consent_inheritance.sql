-- Ao vincular um responsável legal, o novo cadastro da criança herda as
-- decisões de consentimento registradas pelo responsável.

create or replace function public.inherit_child_consent_from_guardian()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.legal_guardian and new.primary_contact then
    insert into public.people_consents (
      person_id,
      church_id,
      messaging,
      representatives_contact,
      event_filming,
      event_photography,
      data_processing,
      social_media_image,
      marketing,
      consented_at,
      updated_at
    )
    select
      new.child_id,
      new.church_id,
      consent.messaging,
      consent.representatives_contact,
      consent.event_filming,
      consent.event_photography,
      consent.data_processing,
      consent.social_media_image,
      consent.marketing,
      consent.consented_at,
      now()
    from public.people_consents consent
    where consent.person_id = new.guardian_person_id
    on conflict (person_id) do update set
      messaging = excluded.messaging,
      representatives_contact = excluded.representatives_contact,
      event_filming = excluded.event_filming,
      event_photography = excluded.event_photography,
      data_processing = excluded.data_processing,
      social_media_image = excluded.social_media_image,
      marketing = excluded.marketing,
      consented_at = excluded.consented_at,
      updated_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists inherit_child_consent_after_guardian_link
  on public.child_guardians;
create trigger inherit_child_consent_after_guardian_link
after insert or update of guardian_person_id, legal_guardian, primary_contact
on public.child_guardians
for each row
execute function public.inherit_child_consent_from_guardian();
