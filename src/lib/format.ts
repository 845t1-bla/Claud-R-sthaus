import type { Assessment, Condition, Member, SaleType } from './types';

const eur = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
export const euro = (n: number | null | undefined) => eur.format(Number(n ?? 0));

export const formatDate = (d: string | null | undefined) =>
  d ? new Date(d.length === 10 ? d + 'T00:00:00' : d).toLocaleDateString('de-DE') : '';

export const formatDateTime = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }) : '';

export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const firstOfMonth = () => today().slice(0, 8) + '01';
export const firstOfYear = () => today().slice(0, 5) + '01-01';

export const CONDITION_LABELS: Record<Condition, string> = {
  neu: 'Neu',
  gebraucht_flat: 'Gebraucht (Flat)',
  haertefall: 'Härtefall',
};
export const CONDITION_COLORS: Record<Condition, string> = {
  neu: 'blue',
  gebraucht_flat: 'teal',
  haertefall: 'orange',
};
export const CONDITIONS: Condition[] = ['neu', 'gebraucht_flat', 'haertefall'];

export const SALE_TYPE_LABELS: Record<SaleType, string> = {
  verkauf: 'Verkauf',
  flat_ausgabe: 'Kluftflat',
  flat_tausch: 'Flat-Tausch',
};
export const SALE_TYPE_COLORS: Record<SaleType, string> = {
  verkauf: 'blue',
  flat_ausgabe: 'grape',
  flat_tausch: 'teal',
};

export const ASSESSMENT_LABELS: Record<Assessment, string> = {
  sauber: 'Sauber & unbeschädigt',
  beschaedigt_ok: 'Beschädigt, aber noch tragbar',
  unbrauchbar: 'Nicht mehr verwendbar',
};

export const PAYMENT_OPTIONS = [
  { value: 'bar', label: 'Bar' },
  { value: 'ueberweisung', label: 'Überweisung' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'sonstiges', label: 'Sonstiges' },
];
export const paymentLabel = (p: string) => PAYMENT_OPTIONS.find((o) => o.value === p)?.label ?? p;

export const MOVEMENT_LABELS: Record<string, string> = {
  wareneingang: 'Wareneingang',
  verkauf: 'Verkauf',
  flat_ausgabe: 'Flat-Ausgabe',
  flat_rueckgabe: 'Flat-Rückgabe',
  entsorgung: 'Entsorgung',
  korrektur: 'Korrektur',
  inventur: 'Inventur',
  storno: 'Storno',
};

export const memberName = (m: Pick<Member, 'first_name' | 'last_name'> | null | undefined) =>
  m ? `${m.first_name} ${m.last_name}`.trim() : '–';

export const variantLabel = (v: { size: string; products: { name: string } | null } | null | undefined) =>
  v ? `${v.products?.name ?? '?'}${v.size && v.size !== 'Einheitsgröße' ? ' · ' + v.size : ''}` : '–';

export const sizeLabel = (size: string) => (size === 'Einheitsgröße' ? '' : size);
