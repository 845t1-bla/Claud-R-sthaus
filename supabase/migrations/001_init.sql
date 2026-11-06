-- =====================================================================
-- Rüsthaus Roßtal – Datenbankschema
-- Im Supabase-Dashboard unter "SQL Editor" komplett ausführen.
-- =====================================================================


-- ---------------------------------------------------------------------
-- Tabellen
-- ---------------------------------------------------------------------

-- Ausgabe-/Verkaufsberechtigte Personen
create table public.staff (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid unique references auth.users(id) on delete set null,
  name        text not null,
  email       text,
  role        text not null default 'ausgeber' check (role in ('admin', 'ausgeber')),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Mitglieder / Käufer
create table public.members (
  id          uuid primary key default gen_random_uuid(),
  first_name  text not null,
  last_name   text not null default '',
  group_name  text,
  contact     text,
  notes       text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table public.categories (
  id        uuid primary key default gen_random_uuid(),
  name      text not null unique,
  sort      int not null default 0,
  is_kluft  boolean not null default false   -- Produkte dieser Kategorie können per Kluftflat ausgegeben werden
);

create table public.products (
  id           uuid primary key default gen_random_uuid(),
  category_id  uuid not null references public.categories(id) on delete restrict,
  name         text not null,
  description  text,
  price        numeric(10,2) not null default 0 check (price >= 0),
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

create table public.product_images (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  path        text not null,
  sort        int not null default 0,
  is_main     boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Größen-Varianten eines Produkts
create table public.variants (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  size        text not null default 'Einheitsgröße',
  price       numeric(10,2) check (price is null or price >= 0),  -- leer = Produktpreis
  min_stock   int not null default 0,
  sort        int not null default 0,
  active      boolean not null default true,
  unique (product_id, size)
);

-- Bestand je Variante und Zustand
create table public.stock (
  variant_id  uuid not null references public.variants(id) on delete cascade,
  condition   text not null check (condition in ('neu', 'gebraucht_flat', 'haertefall')),
  quantity    int not null default 0 check (quantity >= 0),
  updated_at  timestamptz not null default now(),
  primary key (variant_id, condition)
);

create table public.flat_contracts (
  id                  uuid primary key default gen_random_uuid(),
  member_id           uuid not null references public.members(id) on delete restrict,
  started_at          date not null default current_date,
  status              text not null default 'aktiv' check (status in ('aktiv', 'beendet', 'storniert')),
  current_variant_id  uuid references public.variants(id) on delete restrict, -- null = Kluft zurückgegeben, Tausch ausstehend
  fee_paid            numeric(10,2) not null default 0 check (fee_paid >= 0),
  ended_at            date,
  note                text,
  created_at          timestamptz not null default now()
);

create table public.sales (
  id                uuid primary key default gen_random_uuid(),
  sale_date         date not null default current_date,
  created_at        timestamptz not null default now(),
  member_id         uuid not null references public.members(id) on delete restrict,
  staff_id          uuid not null references public.staff(id) on delete restrict,
  type              text not null default 'verkauf' check (type in ('verkauf', 'flat_ausgabe', 'flat_tausch')),
  payment           text not null default 'bar',
  note              text,
  flat_fee          numeric(10,2) not null default 0 check (flat_fee >= 0),
  fee_reason        text,
  total             numeric(10,2) not null default 0,
  flat_contract_id  uuid references public.flat_contracts(id) on delete set null,
  cancelled         boolean not null default false,
  cancelled_at      timestamptz,
  cancel_reason     text,
  created_by        uuid references public.staff(id) on delete set null,
  updated_at        timestamptz
);

create table public.sale_items (
  id                 uuid primary key default gen_random_uuid(),
  sale_id            uuid not null references public.sales(id) on delete cascade,
  variant_id         uuid not null references public.variants(id) on delete restrict,
  condition          text not null default 'neu' check (condition in ('neu', 'gebraucht_flat', 'haertefall')),
  quantity           int not null check (quantity > 0),
  list_price         numeric(10,2) not null,
  unit_price         numeric(10,2) not null check (unit_price >= 0),
  reason             text,
  is_flat_component  boolean not null default false,
  is_flat_kluft      boolean not null default false,
  -- Pflichtgrund für rabattierte oder kostenlose Ware
  constraint reason_required check (
    is_flat_component or unit_price >= list_price or coalesce(length(trim(reason)), 0) > 0
  )
);

create table public.sale_changes (
  id           uuid primary key default gen_random_uuid(),
  sale_id      uuid not null references public.sales(id) on delete cascade,
  changed_at   timestamptz not null default now(),
  staff_id     uuid references public.staff(id) on delete set null,
  description  text not null
);

create table public.flat_returns (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  return_date  date not null default current_date,
  contract_id  uuid not null references public.flat_contracts(id) on delete cascade,
  variant_id   uuid not null references public.variants(id) on delete restrict,
  assessment   text not null check (assessment in ('sauber', 'beschaedigt_ok', 'unbrauchbar')),
  staff_id     uuid references public.staff(id) on delete set null,
  note         text
);

create table public.stock_movements (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  variant_id  uuid not null references public.variants(id) on delete restrict,
  condition   text not null check (condition in ('neu', 'gebraucht_flat', 'haertefall')),
  delta       int not null,
  kind        text not null check (kind in ('wareneingang', 'verkauf', 'flat_ausgabe', 'flat_rueckgabe',
                                            'entsorgung', 'korrektur', 'inventur', 'storno')),
  reason      text,
  staff_id    uuid references public.staff(id) on delete set null,
  sale_id     uuid references public.sales(id) on delete set null
);

create table public.settings (
  key    text primary key,
  value  jsonb not null
);

-- Standard-Aufnäher, die zur Kluftflat gehören
create table public.flat_patch_defaults (
  id          uuid primary key default gen_random_uuid(),
  variant_id  uuid not null unique references public.variants(id) on delete cascade,
  quantity    int not null default 1 check (quantity > 0),
  sort        int not null default 0
);

create index on public.sales (sale_date desc);
create index on public.sales (member_id);
create index on public.sale_items (sale_id);
create index on public.stock_movements (created_at desc);
create index on public.stock_movements (sale_id);
create index on public.flat_contracts (member_id);

insert into public.settings (key, value) values ('flat_price', '40') on conflict do nothing;

-- ---------------------------------------------------------------------
-- Berechtigungs-Hilfsfunktionen
-- ---------------------------------------------------------------------

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from staff where user_id = auth.uid() and active);
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from staff where user_id = auth.uid() and active and role = 'admin');
$$;

create or replace function public.current_staff_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from staff where user_id = auth.uid() and active limit 1;
$$;

-- Prüft Berechtigung und liefert den (übergebenen oder eingeloggten) Ausgeber
create or replace function public._staff_or_current(p_staff uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  if not is_staff() then
    raise exception 'Keine Berechtigung.';
  end if;
  if p_staff is null then
    return current_staff_id();
  end if;
  select id into v from staff where id = p_staff and active;
  if v is null then
    raise exception 'Ausgeber ist unbekannt oder inaktiv.';
  end if;
  return v;
end $$;

create or replace function public._variant_label(p_variant uuid) returns text
language sql stable security definer set search_path = public as $$
  select p.name || ' (' || v.size || ')' from variants v join products p on p.id = v.product_id where v.id = p_variant;
$$;

create or replace function public._flat_price() returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce((select (value #>> '{}')::numeric from settings where key = 'flat_price'), 40);
$$;

create or replace function public._condition_label(p text) returns text
language sql immutable as $$
  select case p when 'neu' then 'neu' when 'gebraucht_flat' then 'gebraucht/Flat' when 'haertefall' then 'Härtefall' else p end;
$$;

-- Zentrale Bestandsbuchung (nur intern aufrufbar)
create or replace function public._move_stock(
  p_variant uuid, p_condition text, p_delta int, p_kind text, p_reason text, p_staff uuid, p_sale uuid
) returns void
language plpgsql security definer set search_path = public as $$
declare v_qty int;
begin
  if p_delta = 0 then return; end if;
  insert into stock (variant_id, condition, quantity) values (p_variant, p_condition, 0) on conflict do nothing;
  select quantity into v_qty from stock where variant_id = p_variant and condition = p_condition for update;
  if v_qty + p_delta < 0 then
    raise exception 'Nicht genug Bestand: % – %: vorhanden %, benötigt %',
      _variant_label(p_variant), _condition_label(p_condition), v_qty, -p_delta;
  end if;
  update stock set quantity = quantity + p_delta, updated_at = now()
   where variant_id = p_variant and condition = p_condition;
  insert into stock_movements (variant_id, condition, delta, kind, reason, staff_id, sale_id)
  values (p_variant, p_condition, p_delta, p_kind, p_reason, p_staff, p_sale);
end $$;

-- ---------------------------------------------------------------------
-- Buchungsfunktionen (werden von der App aufgerufen)
-- ---------------------------------------------------------------------

-- Verkauf aus dem Warenkorb abschließen
-- p_items: [{variant_id, condition, quantity, unit_price, reason}]
create or replace function public.complete_sale(
  p_member uuid, p_staff uuid, p_payment text, p_note text, p_items jsonb, p_date date default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_staff uuid; v_sale uuid; v_item jsonb; v_variant uuid; v_cond text;
  v_qty int; v_price numeric; v_list numeric; v_reason text; v_total numeric := 0;
begin
  v_staff := _staff_or_current(p_staff);
  if p_member is null then raise exception 'Bitte einen Käufer auswählen.'; end if;
  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then raise exception 'Der Warenkorb ist leer.'; end if;

  insert into sales (member_id, staff_id, type, payment, note, sale_date, created_by)
  values (p_member, v_staff, 'verkauf', coalesce(nullif(p_payment, ''), 'bar'), nullif(trim(p_note), ''),
          coalesce(p_date, current_date), current_staff_id())
  returning id into v_sale;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_variant := (v_item->>'variant_id')::uuid;
    v_cond    := coalesce(v_item->>'condition', 'neu');
    v_qty     := (v_item->>'quantity')::int;
    v_price   := round((v_item->>'unit_price')::numeric, 2);
    v_reason  := nullif(trim(v_item->>'reason'), '');

    select coalesce(v.price, p.price) into v_list
      from variants v join products p on p.id = v.product_id where v.id = v_variant;
    if v_list is null then raise exception 'Unbekannter Artikel im Warenkorb.'; end if;
    if v_qty is null or v_qty <= 0 then raise exception 'Ungültige Menge bei %.', _variant_label(v_variant); end if;
    if v_price is null or v_price < 0 then raise exception 'Ungültiger Preis bei %.', _variant_label(v_variant); end if;
    if v_price < v_list and v_reason is null then
      raise exception 'Für rabattierte oder kostenlose Artikel ist ein Grund Pflicht (%).', _variant_label(v_variant);
    end if;

    insert into sale_items (sale_id, variant_id, condition, quantity, list_price, unit_price, reason)
    values (v_sale, v_variant, v_cond, v_qty, v_list, v_price, v_reason);
    perform _move_stock(v_variant, v_cond, -v_qty, 'verkauf', v_reason, v_staff, v_sale);
    v_total := v_total + v_qty * v_price;
  end loop;

  update sales set total = v_total where id = v_sale;
  return v_sale;
end $$;

-- Kluftflat ausgeben (neu) oder tauschen (p_contract gesetzt)
-- p_patches: [{variant_id, quantity}] – nur die tatsächlich auszugebenden Aufnäher
create or replace function public.issue_flat(
  p_member uuid, p_staff uuid, p_kluft_variant uuid, p_kluft_condition text, p_patches jsonb,
  p_fee numeric, p_fee_reason text, p_payment text, p_note text,
  p_contract uuid default null, p_date date default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_staff uuid; v_sale uuid; v_contract uuid := p_contract; v_type text; v_fee numeric;
  v_member uuid := p_member; v_flat_price numeric := _flat_price(); v_p jsonb; v_list numeric;
  v_qty int; v_current uuid; v_is_kluft boolean;
begin
  v_staff := _staff_or_current(p_staff);
  if p_kluft_variant is null then raise exception 'Bitte eine Kluft auswählen.'; end if;

  select c.is_kluft into v_is_kluft from variants v join products p on p.id = v.product_id
    join categories c on c.id = p.category_id where v.id = p_kluft_variant;
  if not coalesce(v_is_kluft, false) then raise exception 'Der gewählte Artikel ist keine Kluft.'; end if;

  if v_contract is null then
    if v_member is null then raise exception 'Bitte ein Mitglied auswählen.'; end if;
    if exists (select 1 from flat_contracts where member_id = v_member and status = 'aktiv') then
      raise exception 'Dieses Mitglied hat bereits eine aktive Kluftflat. Bitte Rückgabe/Tausch nutzen.';
    end if;
    v_type := 'flat_ausgabe';
    v_fee := round(coalesce(p_fee, v_flat_price), 2);
    if v_fee < 0 then raise exception 'Ungültiger Betrag.'; end if;
    if v_fee < v_flat_price and nullif(trim(p_fee_reason), '') is null then
      raise exception 'Der Flat-Betrag ist reduziert – bitte einen Grund angeben.';
    end if;
  else
    select member_id, current_variant_id into v_member, v_current
      from flat_contracts where id = v_contract and status = 'aktiv' for update;
    if not found then raise exception 'Kein aktiver Kluftflat-Vertrag gefunden.'; end if;
    if v_current is not null then
      raise exception 'Die bisherige Kluft wurde noch nicht zurückgegeben.';
    end if;
    v_type := 'flat_tausch';
    v_fee := 0;
  end if;

  insert into sales (member_id, staff_id, type, payment, note, sale_date, flat_fee, fee_reason, created_by)
  values (v_member, v_staff, v_type, coalesce(nullif(p_payment, ''), 'bar'), nullif(trim(p_note), ''),
          coalesce(p_date, current_date), v_fee,
          case when v_type = 'flat_ausgabe' then nullif(trim(p_fee_reason), '') end, current_staff_id())
  returning id into v_sale;

  -- Kluft
  select coalesce(v.price, p.price) into v_list from variants v join products p on p.id = v.product_id where v.id = p_kluft_variant;
  insert into sale_items (sale_id, variant_id, condition, quantity, list_price, unit_price, is_flat_component, is_flat_kluft)
  values (v_sale, p_kluft_variant, coalesce(p_kluft_condition, 'neu'), 1, v_list, 0, true, true);
  perform _move_stock(p_kluft_variant, coalesce(p_kluft_condition, 'neu'), -1, 'flat_ausgabe', null, v_staff, v_sale);

  -- Aufnäher (nur die ausgewählten)
  for v_p in select * from jsonb_array_elements(coalesce(p_patches, '[]'::jsonb)) loop
    v_qty := coalesce((v_p->>'quantity')::int, 1);
    continue when v_qty <= 0;
    select coalesce(v.price, p.price) into v_list from variants v join products p on p.id = v.product_id
     where v.id = (v_p->>'variant_id')::uuid;
    if v_list is null then raise exception 'Unbekannter Aufnäher.'; end if;
    insert into sale_items (sale_id, variant_id, condition, quantity, list_price, unit_price, is_flat_component)
    values (v_sale, (v_p->>'variant_id')::uuid, 'neu', v_qty, v_list, 0, true);
    perform _move_stock((v_p->>'variant_id')::uuid, 'neu', -v_qty, 'flat_ausgabe', null, v_staff, v_sale);
  end loop;

  if v_contract is null then
    insert into flat_contracts (member_id, started_at, status, current_variant_id, fee_paid, note)
    values (v_member, coalesce(p_date, current_date), 'aktiv', p_kluft_variant, v_fee, nullif(trim(p_note), ''))
    returning id into v_contract;
  else
    update flat_contracts set current_variant_id = p_kluft_variant where id = v_contract;
  end if;

  update sales set total = v_fee, flat_contract_id = v_contract where id = v_sale;
  return v_sale;
end $$;

-- Rückgabe einer Flat-Kluft
-- sauber          -> Bestand "gebraucht/Flat", Tausch im Rahmen der Flat möglich (oder Flat beenden)
-- beschaedigt_ok  -> Bestand "Härtefall", Flat endet (neue Kluft nur gegen erneute Zahlung)
-- unbrauchbar     -> wird entsorgt, Flat endet (neue Kluft nur gegen erneute Zahlung)
create or replace function public.return_flat(
  p_contract uuid, p_staff uuid, p_assessment text, p_note text, p_end boolean default false, p_date date default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_staff uuid; c flat_contracts%rowtype; v_return uuid; v_note text := nullif(trim(p_note), '');
begin
  v_staff := _staff_or_current(p_staff);
  select * into c from flat_contracts where id = p_contract and status = 'aktiv' for update;
  if not found then raise exception 'Kein aktiver Kluftflat-Vertrag gefunden.'; end if;
  if c.current_variant_id is null then raise exception 'Zu diesem Vertrag ist aktuell keine Kluft ausgegeben.'; end if;

  if p_assessment = 'sauber' then
    perform _move_stock(c.current_variant_id, 'gebraucht_flat', 1, 'flat_rueckgabe', coalesce(v_note, 'Flat-Rückgabe sauber'), v_staff, null);
  elsif p_assessment = 'beschaedigt_ok' then
    perform _move_stock(c.current_variant_id, 'haertefall', 1, 'flat_rueckgabe', coalesce(v_note, 'Flat-Rückgabe beschädigt'), v_staff, null);
  elsif p_assessment = 'unbrauchbar' then
    null; -- wird entsorgt, kein Bestand
  else
    raise exception 'Ungültige Bewertung.';
  end if;

  insert into flat_returns (contract_id, variant_id, assessment, staff_id, note, return_date)
  values (p_contract, c.current_variant_id, p_assessment, v_staff, v_note, coalesce(p_date, current_date))
  returning id into v_return;

  if p_assessment = 'sauber' and not coalesce(p_end, false) then
    update flat_contracts set current_variant_id = null where id = p_contract;
  else
    update flat_contracts set current_variant_id = null, status = 'beendet', ended_at = coalesce(p_date, current_date)
     where id = p_contract;
  end if;
  return v_return;
end $$;

-- Flat beenden, wenn Kluft zurück ist und kein Tausch mehr erfolgt
create or replace function public.end_flat(p_contract uuid, p_note text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform _staff_or_current(null);
  update flat_contracts
     set status = 'beendet', ended_at = current_date,
         note = concat_ws(' | ', note, nullif(trim(p_note), ''))
   where id = p_contract and status = 'aktiv' and current_variant_id is null;
  if not found then raise exception 'Vertrag kann nicht beendet werden (Kluft noch ausgegeben?).'; end if;
end $$;

-- Verkauf bearbeiten
-- p_items: [{id, quantity, unit_price, reason}] – quantity 0 entfernt die Position
create or replace function public.update_sale(
  p_sale uuid, p_member uuid, p_staff uuid, p_payment text, p_note text, p_date date,
  p_items jsonb, p_fee numeric default null, p_fee_reason text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  s sales%rowtype; it sale_items%rowtype; v_editor uuid; v_new_staff uuid; v_item jsonb;
  v_qty int; v_price numeric; v_reason text; v_changes text[] := '{}'; v_fee numeric; v_fee_reason text;
begin
  v_editor := _staff_or_current(null);
  select * into s from sales where id = p_sale for update;
  if not found then raise exception 'Verkauf nicht gefunden.'; end if;
  if s.cancelled then raise exception 'Stornierte Verkäufe können nicht bearbeitet werden.'; end if;
  if p_member is null then raise exception 'Bitte einen Käufer auswählen.'; end if;
  v_new_staff := _staff_or_current(coalesce(p_staff, s.staff_id));

  if p_member <> s.member_id then v_changes := v_changes || 'Käufer geändert'::text; end if;
  if v_new_staff <> s.staff_id then v_changes := v_changes || 'Ausgeber geändert'::text; end if;
  if coalesce(p_payment, '') <> coalesce(s.payment, '') then v_changes := v_changes || 'Zahlungsart geändert'::text; end if;
  if coalesce(trim(p_note), '') <> coalesce(s.note, '') then v_changes := v_changes || 'Notiz geändert'::text; end if;
  if p_date is not null and p_date <> s.sale_date then v_changes := v_changes || 'Datum geändert'::text; end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    select * into it from sale_items where id = (v_item->>'id')::uuid and sale_id = p_sale for update;
    if not found then raise exception 'Position nicht gefunden.'; end if;
    v_qty := coalesce((v_item->>'quantity')::int, it.quantity);
    v_price := case when it.is_flat_component then 0
                    else round(coalesce((v_item->>'unit_price')::numeric, it.unit_price), 2) end;
    v_reason := case when v_item ? 'reason' then nullif(trim(v_item->>'reason'), '') else it.reason end;
    if v_qty < 0 or v_price < 0 then raise exception 'Ungültige Menge oder Preis.'; end if;
    if it.is_flat_kluft and v_qty <> it.quantity then
      raise exception 'Die Flat-Kluft kann nicht über die Bearbeitung entfernt werden – bitte stornieren.';
    end if;

    if v_qty <> it.quantity then
      perform _move_stock(it.variant_id, it.condition, it.quantity - v_qty, 'korrektur', 'Verkauf bearbeitet', v_editor, p_sale);
      v_changes := v_changes || format('%s: Menge %s → %s', _variant_label(it.variant_id), it.quantity, v_qty);
    end if;
    if v_qty = 0 then
      delete from sale_items where id = it.id;
      continue;
    end if;
    if not it.is_flat_component and v_price < it.list_price and v_reason is null then
      raise exception 'Für rabattierte oder kostenlose Artikel ist ein Grund Pflicht (%).', _variant_label(it.variant_id);
    end if;
    if v_price <> it.unit_price then
      v_changes := v_changes || format('%s: Preis %s → %s', _variant_label(it.variant_id), it.unit_price, v_price);
    end if;
    if v_reason is distinct from it.reason then
      v_changes := v_changes || format('%s: Grund geändert', _variant_label(it.variant_id));
    end if;
    update sale_items set quantity = v_qty, unit_price = v_price, reason = v_reason where id = it.id;
  end loop;

  v_fee := s.flat_fee; v_fee_reason := s.fee_reason;
  if s.type = 'flat_ausgabe' then
    if p_fee is not null then v_fee := round(p_fee, 2); end if;
    if p_fee_reason is not null then v_fee_reason := nullif(trim(p_fee_reason), ''); end if;
    if v_fee < 0 then raise exception 'Ungültiger Betrag.'; end if;
    if v_fee < _flat_price() and v_fee_reason is null then
      raise exception 'Der Flat-Betrag ist reduziert – bitte einen Grund angeben.';
    end if;
    if v_fee <> s.flat_fee then
      v_changes := v_changes || format('Flat-Betrag %s → %s', s.flat_fee, v_fee);
      update flat_contracts set fee_paid = v_fee where id = s.flat_contract_id;
    end if;
    if p_member <> s.member_id then
      update flat_contracts set member_id = p_member where id = s.flat_contract_id;
    end if;
  end if;

  update sales set
    member_id = p_member, staff_id = v_new_staff, payment = coalesce(nullif(p_payment, ''), payment),
    note = nullif(trim(p_note), ''), sale_date = coalesce(p_date, sale_date),
    flat_fee = v_fee, fee_reason = v_fee_reason, updated_at = now()
  where id = p_sale;
  update sales set total = flat_fee + coalesce((select sum(quantity * unit_price) from sale_items where sale_id = p_sale), 0)
   where id = p_sale;

  if array_length(v_changes, 1) > 0 then
    insert into sale_changes (sale_id, staff_id, description) values (p_sale, v_editor, array_to_string(v_changes, '; '));
  end if;
end $$;

-- Verkauf stornieren (Bestand wird zurückgebucht)
create or replace function public.cancel_sale(p_sale uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare s sales%rowtype; v_editor uuid; m record; v_kluft uuid;
begin
  v_editor := _staff_or_current(null);
  if nullif(trim(p_reason), '') is null then raise exception 'Bitte einen Grund für die Stornierung angeben.'; end if;
  select * into s from sales where id = p_sale for update;
  if not found then raise exception 'Verkauf nicht gefunden.'; end if;
  if s.cancelled then raise exception 'Der Verkauf ist bereits storniert.'; end if;

  if s.type in ('flat_ausgabe', 'flat_tausch') and s.flat_contract_id is not null then
    select variant_id into v_kluft from sale_items where sale_id = p_sale and is_flat_kluft limit 1;
    if exists (select 1 from flat_returns r where r.contract_id = s.flat_contract_id and r.created_at > s.created_at)
       or not exists (select 1 from flat_contracts c where c.id = s.flat_contract_id and c.status = 'aktiv'
                      and c.current_variant_id is not distinct from v_kluft) then
      raise exception 'Diese Kluft wurde bereits zurückgegeben/getauscht – Stornierung nicht möglich.';
    end if;
  end if;

  for m in select variant_id, condition, sum(delta) as d from stock_movements
            where sale_id = p_sale group by variant_id, condition loop
    perform _move_stock(m.variant_id, m.condition, -m.d::int, 'storno', trim(p_reason), v_editor, p_sale);
  end loop;

  update sales set cancelled = true, cancelled_at = now(), cancel_reason = trim(p_reason) where id = p_sale;

  if s.type = 'flat_ausgabe' then
    update flat_contracts set status = 'storniert', current_variant_id = null, ended_at = current_date
     where id = s.flat_contract_id;
  elsif s.type = 'flat_tausch' then
    update flat_contracts set current_variant_id = null where id = s.flat_contract_id;
  end if;

  insert into sale_changes (sale_id, staff_id, description) values (p_sale, v_editor, 'Storniert: ' || trim(p_reason));
end $$;

-- Wareneingang, Korrektur, Entsorgung
create or replace function public.adjust_stock(
  p_variant uuid, p_condition text, p_delta int, p_kind text, p_reason text
) returns void
language plpgsql security definer set search_path = public as $$
declare v_staff uuid;
begin
  v_staff := _staff_or_current(null);
  if p_kind not in ('wareneingang', 'korrektur', 'entsorgung') then raise exception 'Ungültige Buchungsart.'; end if;
  if coalesce(p_delta, 0) = 0 then raise exception 'Die Menge darf nicht 0 sein.'; end if;
  if p_kind = 'wareneingang' and p_delta < 0 then raise exception 'Wareneingang muss positiv sein.'; end if;
  if p_kind = 'entsorgung' and p_delta > 0 then raise exception 'Entsorgung muss negativ sein.'; end if;
  if p_kind <> 'wareneingang' and nullif(trim(p_reason), '') is null then raise exception 'Bitte einen Grund angeben.'; end if;
  perform _move_stock(p_variant, p_condition, p_delta, p_kind, nullif(trim(p_reason), ''), v_staff, null);
end $$;

-- Inventur buchen. p_counts: [{variant_id, condition, counted}]
create or replace function public.apply_inventory(p_counts jsonb, p_note text) returns int
language plpgsql security definer set search_path = public as $$
declare v_staff uuid; v_item jsonb; v_counted int; v_cur int; v_n int := 0; v_variant uuid; v_cond text;
begin
  v_staff := _staff_or_current(null);
  for v_item in select * from jsonb_array_elements(coalesce(p_counts, '[]'::jsonb)) loop
    continue when v_item->>'counted' is null or v_item->>'counted' = '';
    v_counted := (v_item->>'counted')::int;
    v_variant := (v_item->>'variant_id')::uuid;
    v_cond := coalesce(v_item->>'condition', 'neu');
    if v_counted < 0 then raise exception 'Gezählte Menge darf nicht negativ sein.'; end if;
    insert into stock (variant_id, condition, quantity) values (v_variant, v_cond, 0) on conflict do nothing;
    select quantity into v_cur from stock where variant_id = v_variant and condition = v_cond for update;
    if v_counted <> v_cur then
      perform _move_stock(v_variant, v_cond, v_counted - v_cur, 'inventur',
                          coalesce(nullif(trim(p_note), ''), 'Inventur'), v_staff, null);
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end $$;

-- Interne Funktionen nicht von außen aufrufbar
revoke execute on function public._move_stock(uuid, text, int, text, text, uuid, uuid) from public, anon, authenticated;
revoke execute on function public._staff_or_current(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Neue Logins automatisch als Ausgeber anlegen
-- Erster Nutzer = Admin. Weitere Nutzer werden mit einem vom Admin
-- vorab angelegten Ausgeber (gleiche E-Mail) verknüpft, sonst inaktiv angelegt.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from staff where lower(email) = lower(new.email) and user_id is null) then
    update staff set user_id = new.id where lower(email) = lower(new.email) and user_id is null;
  elsif not exists (select 1 from staff where role = 'admin') then
    insert into staff (user_id, name, email, role, active)
    values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)), new.email, 'admin', true);
  else
    insert into staff (user_id, name, email, role, active)
    values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)), new.email, 'ausgeber', false);
  end if;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Sichten
-- ---------------------------------------------------------------------
create or replace view public.v_stock with (security_invoker = true) as
select v.id as variant_id, p.id as product_id, p.name as product_name, c.id as category_id, c.name as category_name,
       c.sort as category_sort, v.size, v.sort as variant_sort, cond.condition,
       coalesce(s.quantity, 0) as quantity, coalesce(v.price, p.price) as price, v.min_stock,
       (p.active and v.active) as active
  from variants v
  join products p on p.id = v.product_id
  join categories c on c.id = p.category_id
 cross join (values ('neu'), ('gebraucht_flat'), ('haertefall')) as cond(condition)
  left join stock s on s.variant_id = v.id and s.condition = cond.condition;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['staff','members','categories','products','product_images','variants','stock',
                           'stock_movements','sales','sale_items','sale_changes','flat_contracts','flat_returns',
                           'settings','flat_patch_defaults'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "Lesen für Ausgeber" on public.%I for select to authenticated using (public.is_staff())', t);
  end loop;
  -- Stammdaten: alle Ausgeber dürfen bearbeiten
  foreach t in array array['members','categories','products','product_images','variants','flat_patch_defaults'] loop
    execute format('create policy "Schreiben für Ausgeber" on public.%I for all to authenticated using (public.is_staff()) with check (public.is_staff())', t);
  end loop;
  -- Ausgeber & Einstellungen: nur Admins
  foreach t in array array['staff','settings'] loop
    execute format('create policy "Schreiben für Admins" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
  -- Bestand, Verkäufe, Flat: Schreiben ausschließlich über die Buchungsfunktionen
end $$;

create policy "Eigenen Ausgeber-Eintrag lesen" on public.staff for select to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- Speicher für Produktbilder
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('produktbilder', 'produktbilder', true)
on conflict (id) do nothing;

create policy "Produktbilder hochladen" on storage.objects for insert to authenticated
  with check (bucket_id = 'produktbilder' and public.is_staff());
create policy "Produktbilder ändern" on storage.objects for update to authenticated
  using (bucket_id = 'produktbilder' and public.is_staff());
create policy "Produktbilder löschen" on storage.objects for delete to authenticated
  using (bucket_id = 'produktbilder' and public.is_staff());
