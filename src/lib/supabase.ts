import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const configured = Boolean(url && key && !url.includes('DEIN-PROJEKT'));

export const supabase = createClient(configured ? url : 'http://localhost:54321', configured ? key : 'missing-key');

export const IMAGE_BUCKET = 'produktbilder';

export function imageUrl(path: string): string {
  return supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Wartet auf eine Supabase-Abfrage und wirft bei Fehler eine lesbare Exception. */
export async function q<T>(query: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await query;
  if (error) throw new Error(translateError(error.message));
  return data as T;
}

export async function rpc<T = unknown>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(translateError(error.message));
  return data as T;
}

function translateError(msg: string): string {
  if (msg.includes('violates foreign key constraint')) {
    return 'Der Eintrag wird noch verwendet (z. B. in Verkäufen) und kann nicht gelöscht werden. Bitte stattdessen deaktivieren.';
  }
  if (msg.includes('duplicate key')) return 'Dieser Eintrag existiert bereits.';
  if (msg.includes('row-level security')) return 'Keine Berechtigung für diese Aktion.';
  if (msg.includes('reason_required')) return 'Für rabattierte oder kostenlose Artikel ist ein Grund Pflicht.';
  return msg;
}
