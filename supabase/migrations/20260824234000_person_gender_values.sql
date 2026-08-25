update public.people
set gender = case
  when lower(coalesce(gender, '')) in ('masculino', 'homem') then 'Homem'
  when lower(coalesce(gender, '')) in ('feminino', 'mulher') then 'Mulher'
  else 'Prefiro não informar'
end
where gender is not null;

alter table public.people
  drop constraint if exists people_gender_allowed_check;

alter table public.people
  add constraint people_gender_allowed_check
  check (gender is null or gender in ('Homem', 'Mulher', 'Prefiro não informar'));

