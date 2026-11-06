-- =====================================================================
-- Rüsthaus Roßtal – Keepalive
-- Wird regelmäßig vom Server aufgerufen, damit das Supabase-Projekt im
-- Gratistarif nicht wegen Inaktivität pausiert wird.
-- Schreibt nur einen Zeitstempel in die Einstellungen, sonst nichts.
-- Im Supabase-Dashboard unter "SQL Editor" ausführen.
-- =====================================================================

create or replace function public.keepalive() returns timestamptz
language plpgsql security definer set search_path = public as $$
declare v timestamptz := now();
begin
  insert into settings (key, value) values ('last_keepalive', to_jsonb(v))
  on conflict (key) do update set value = excluded.value;
  return v;
end $$;

revoke execute on function public.keepalive() from public;
grant execute on function public.keepalive() to anon, authenticated;
