-- =====================================================================
-- Startdaten (optional): Kategorien, Beispielprodukte, Standard-Aufnäher
-- Preise sind BEISPIELE – bitte in der App unter "Produkte" anpassen.
-- Läuft nur, wenn noch keine Produkte existieren.
-- =====================================================================

insert into public.categories (name, sort, is_kluft) values
  ('Kluft', 1, true), ('Kluftbluse', 2, true), ('Aufnäher', 3, false),
  ('Halstuch', 4, false), ('Pullover', 5, false), ('T-Shirt', 6, false)
on conflict (name) do nothing;

do $$
declare
  p uuid;
  kids_adult text[] := array['128','140','152','164','XS','S','M','L','XL','XXL'];
  adult text[] := array['XS','S','M','L','XL','XXL'];
begin
  if exists (select 1 from public.products) then
    raise notice 'Produkte vorhanden – Seed übersprungen.';
    return;
  end if;

  insert into public.products (category_id, name, price)
  values ((select id from public.categories where name = 'Kluft'), 'Kluft', 35) returning id into p;
  insert into public.variants (product_id, size, sort) select p, s, n from unnest(kids_adult) with ordinality t(s, n);

  insert into public.products (category_id, name, price)
  values ((select id from public.categories where name = 'Kluftbluse'), 'Kluftbluse', 35) returning id into p;
  insert into public.variants (product_id, size, sort) select p, s, n from unnest(kids_adult) with ordinality t(s, n);

  insert into public.products (category_id, name, price)
  values ((select id from public.categories where name = 'Halstuch'), 'Halstuch Stamm Roßtal', 8) returning id into p;
  insert into public.variants (product_id, size) values (p, 'Einheitsgröße');

  insert into public.products (category_id, name, price)
  values ((select id from public.categories where name = 'Pullover'), 'Stammespullover', 30) returning id into p;
  insert into public.variants (product_id, size, sort) select p, s, n from unnest(kids_adult) with ordinality t(s, n);

  insert into public.products (category_id, name, price)
  values ((select id from public.categories where name = 'T-Shirt'), 'Stammes-T-Shirt', 15) returning id into p;
  insert into public.variants (product_id, size, sort) select p, s, n from unnest(adult) with ordinality t(s, n);

  -- Aufnäher (Standard-Aufnäher der Kluftflat)
  insert into public.products (category_id, name, price)
  select (select id from public.categories where name = 'Aufnäher'), n, 2.5
    from unnest(array['Stammesaufnäher Roßtal', 'Verbandsabzeichen', 'Landesaufnäher', 'Deutschlandfahne', 'Weltpfadfinderabzeichen']) as n;
  insert into public.variants (product_id, size)
  select id, 'Einheitsgröße' from public.products
   where category_id = (select id from public.categories where name = 'Aufnäher');

  insert into public.flat_patch_defaults (variant_id, quantity, sort)
  select v.id, 1, row_number() over (order by p.name)
    from public.variants v join public.products p on p.id = v.product_id
   where p.category_id = (select id from public.categories where name = 'Aufnäher');
end $$;
