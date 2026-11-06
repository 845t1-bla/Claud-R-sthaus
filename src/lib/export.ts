import type { Workbook, Worksheet } from 'exceljs';
import {
  CONDITION_LABELS,
  SALE_TYPE_LABELS,
  formatDate,
  memberName,
  paymentLabel,
  today,
  variantLabel,
} from './format';
import type { Sale, StockRow } from './types';

interface Col {
  header: string;
  key: string;
  width?: number;
  numFmt?: string;
}

const EUR = '#,##0.00 "€"';

async function newWorkbook(): Promise<Workbook> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Rüsthaus Roßtal';
  wb.created = new Date();
  return wb;
}

function addSheet(wb: Workbook, name: string, cols: Col[], rows: Record<string, unknown>[], title?: string): Worksheet {
  const ws = wb.addWorksheet(name);
  let headerRow = 1;
  if (title) {
    ws.addRow([title]).font = { bold: true, size: 14 };
    ws.addRow([`Stand: ${new Date().toLocaleString('de-DE')}`]).font = { italic: true, color: { argb: 'FF666666' } };
    ws.addRow([]);
    headerRow = 4;
  }
  const header = ws.addRow(cols.map((c) => c.header));
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1C7ED6' } };
  });
  rows.forEach((r) => ws.addRow(cols.map((c) => r[c.key] ?? null)));
  cols.forEach((c, i) => {
    const col = ws.getColumn(i + 1);
    col.width = c.width ?? Math.max(10, c.header.length + 2);
    if (c.numFmt) col.numFmt = c.numFmt;
  });
  ws.views = [{ state: 'frozen', ySplit: headerRow }];
  ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: headerRow, column: cols.length } };
  return ws;
}

async function download(wb: Workbook, filename: string) {
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const sizeOf = (s: string) => (s === 'Einheitsgröße' ? '' : s);

/** Bestandsliste */
export async function exportStock(rows: StockRow[], includeZero: boolean) {
  const wb = await newWorkbook();
  const data = rows
    .filter((r) => includeZero ? r.condition === 'neu' || r.quantity > 0 : r.quantity > 0)
    .map((r) => ({
      kategorie: r.category_name,
      produkt: r.product_name,
      groesse: sizeOf(r.size),
      zustand: CONDITION_LABELS[r.condition],
      menge: r.quantity,
      preis: Number(r.price),
      wert: r.condition === 'neu' ? r.quantity * Number(r.price) : 0,
      mindest: r.condition === 'neu' ? r.min_stock : null,
      nachbestellen: r.condition === 'neu' && r.active && r.quantity < r.min_stock ? 'ja' : '',
      aktiv: r.active ? 'ja' : 'nein',
    }));
  const ws = addSheet(
    wb,
    'Bestand',
    [
      { header: 'Kategorie', key: 'kategorie', width: 14 },
      { header: 'Produkt', key: 'produkt', width: 30 },
      { header: 'Größe', key: 'groesse', width: 10 },
      { header: 'Zustand', key: 'zustand', width: 18 },
      { header: 'Menge', key: 'menge', width: 9 },
      { header: 'Preis', key: 'preis', width: 11, numFmt: EUR },
      { header: 'Wert (neu)', key: 'wert', width: 12, numFmt: EUR },
      { header: 'Mindestbestand', key: 'mindest', width: 15 },
      { header: 'Nachbestellen', key: 'nachbestellen', width: 14 },
      { header: 'Aktiv', key: 'aktiv', width: 8 },
    ],
    data,
    'Bestandsliste Rüsthaus Roßtal',
  );
  const sum = ws.addRow(['Summe', '', '', '', data.reduce((a, r) => a + r.menge, 0), '', data.reduce((a, r) => a + r.wert, 0)]);
  sum.font = { bold: true };
  sum.getCell(7).numFmt = EUR;
  await download(wb, `Bestandsliste_${today()}.xlsx`);
}

/** Verkaufsübersicht inkl. Positionen und Zusammenfassung */
export async function exportSales(sales: Sale[], from: string, to: string) {
  const wb = await newWorkbook();
  const active = sales.filter((s) => !s.cancelled);
  const range = `${from ? formatDate(from) : 'Anfang'} – ${to ? formatDate(to) : 'heute'}`;

  addSheet(
    wb,
    'Verkäufe',
    [
      { header: 'Datum', key: 'datum', width: 11 },
      { header: 'Art', key: 'art', width: 12 },
      { header: 'Käufer', key: 'kaeufer', width: 24 },
      { header: 'Gruppe', key: 'gruppe', width: 14 },
      { header: 'Ausgeber', key: 'ausgeber', width: 18 },
      { header: 'Zahlung', key: 'zahlung', width: 12 },
      { header: 'Artikel', key: 'artikel', width: 50 },
      { header: 'Listenwert', key: 'liste', width: 12, numFmt: EUR },
      { header: 'Rabatt', key: 'rabatt', width: 11, numFmt: EUR },
      { header: 'Summe', key: 'summe', width: 11, numFmt: EUR },
      { header: 'Notiz', key: 'notiz', width: 24 },
      { header: 'Storniert', key: 'storno', width: 24 },
    ],
    sales.map((s) => {
      const liste = s.sale_items.filter((i) => !i.is_flat_component).reduce((a, i) => a + i.quantity * Number(i.list_price), 0);
      const paid = s.sale_items.filter((i) => !i.is_flat_component).reduce((a, i) => a + i.quantity * Number(i.unit_price), 0);
      return {
        datum: formatDate(s.sale_date),
        art: SALE_TYPE_LABELS[s.type],
        kaeufer: memberName(s.members),
        gruppe: s.members?.group_name ?? '',
        ausgeber: s.staff?.name ?? '',
        zahlung: paymentLabel(s.payment),
        artikel: s.sale_items.map((i) => `${i.quantity}× ${variantLabel(i.variants)}`).join(', '),
        liste,
        rabatt: liste - paid,
        summe: Number(s.total),
        notiz: [s.note, s.fee_reason].filter(Boolean).join(' / '),
        storno: s.cancelled ? `ja: ${s.cancel_reason ?? ''}` : '',
      };
    }),
    `Verkaufsübersicht ${range}`,
  );

  addSheet(
    wb,
    'Positionen',
    [
      { header: 'Datum', key: 'datum', width: 11 },
      { header: 'Art', key: 'art', width: 12 },
      { header: 'Käufer', key: 'kaeufer', width: 24 },
      { header: 'Ausgeber', key: 'ausgeber', width: 18 },
      { header: 'Produkt', key: 'produkt', width: 28 },
      { header: 'Größe', key: 'groesse', width: 9 },
      { header: 'Zustand', key: 'zustand', width: 16 },
      { header: 'Menge', key: 'menge', width: 8 },
      { header: 'Listenpreis', key: 'liste', width: 12, numFmt: EUR },
      { header: 'Verkaufspreis', key: 'preis', width: 13, numFmt: EUR },
      { header: 'Gesamt', key: 'gesamt', width: 11, numFmt: EUR },
      { header: 'Rabatt/Gratis-Grund', key: 'grund', width: 30 },
      { header: 'Storniert', key: 'storno', width: 10 },
    ],
    sales.flatMap((s) =>
      s.sale_items.map((i) => ({
        datum: formatDate(s.sale_date),
        art: SALE_TYPE_LABELS[s.type],
        kaeufer: memberName(s.members),
        ausgeber: s.staff?.name ?? '',
        produkt: i.variants?.products?.name ?? '',
        groesse: sizeOf(i.variants?.size ?? ''),
        zustand: CONDITION_LABELS[i.condition],
        menge: i.quantity,
        liste: Number(i.list_price),
        preis: Number(i.unit_price),
        gesamt: i.quantity * Number(i.unit_price),
        grund: i.is_flat_component ? 'Teil der Kluftflat' : i.reason ?? '',
        storno: s.cancelled ? 'ja' : '',
      })),
    ),
  );

  // Rabatte & Gratis
  addSheet(
    wb,
    'Rabatte & Gratis',
    [
      { header: 'Datum', key: 'datum', width: 11 },
      { header: 'Käufer', key: 'kaeufer', width: 24 },
      { header: 'Ausgeber', key: 'ausgeber', width: 18 },
      { header: 'Artikel', key: 'artikel', width: 30 },
      { header: 'Menge', key: 'menge', width: 8 },
      { header: 'Nachlass', key: 'nachlass', width: 11, numFmt: EUR },
      { header: 'Grund', key: 'grund', width: 40 },
    ],
    [
      ...active.flatMap((s) =>
        s.sale_items
          .filter((i) => !i.is_flat_component && Number(i.unit_price) < Number(i.list_price))
          .map((i) => ({
            datum: formatDate(s.sale_date),
            kaeufer: memberName(s.members),
            ausgeber: s.staff?.name ?? '',
            artikel: variantLabel(i.variants) + (Number(i.unit_price) === 0 ? ' (gratis)' : ''),
            menge: i.quantity,
            nachlass: i.quantity * (Number(i.list_price) - Number(i.unit_price)),
            grund: i.reason ?? '',
          })),
      ),
      ...active
        .filter((s) => s.type === 'flat_ausgabe' && s.fee_reason)
        .map((s) => ({
          datum: formatDate(s.sale_date),
          kaeufer: memberName(s.members),
          ausgeber: s.staff?.name ?? '',
          artikel: 'Kluftflat (ermäßigt)',
          menge: 1,
          nachlass: null,
          grund: s.fee_reason ?? '',
        })),
    ],
  );

  // Zusammenfassung je Ausgeber
  const byStaff = new Map<string, { anzahl: number; summe: number; verkauf: number; flat: number; tausch: number }>();
  active.forEach((s) => {
    const k = s.staff?.name ?? '?';
    const e = byStaff.get(k) ?? { anzahl: 0, summe: 0, verkauf: 0, flat: 0, tausch: 0 };
    e.anzahl += 1;
    e.summe += Number(s.total);
    if (s.type === 'verkauf') e.verkauf += Number(s.total);
    if (s.type === 'flat_ausgabe') e.flat += Number(s.total);
    if (s.type === 'flat_tausch') e.tausch += 1;
    byStaff.set(k, e);
  });
  const ws = addSheet(
    wb,
    'Zusammenfassung',
    [
      { header: 'Ausgeber', key: 'name', width: 22 },
      { header: 'Vorgänge', key: 'anzahl', width: 10 },
      { header: 'Verkäufe', key: 'verkauf', width: 13, numFmt: EUR },
      { header: 'Kluftflats', key: 'flat', width: 13, numFmt: EUR },
      { header: 'Tausche', key: 'tausch', width: 10 },
      { header: 'Einnahmen gesamt', key: 'summe', width: 17, numFmt: EUR },
    ],
    [...byStaff.entries()].map(([name, e]) => ({ name, ...e })),
    `Zusammenfassung ${range} (ohne Stornos)`,
  );
  const tot = ws.addRow([
    'Gesamt',
    active.length,
    active.filter((s) => s.type === 'verkauf').reduce((a, s) => a + Number(s.total), 0),
    active.filter((s) => s.type === 'flat_ausgabe').reduce((a, s) => a + Number(s.total), 0),
    active.filter((s) => s.type === 'flat_tausch').length,
    active.reduce((a, s) => a + Number(s.total), 0),
  ]);
  tot.font = { bold: true };
  [3, 4, 6].forEach((c) => (tot.getCell(c).numFmt = EUR));

  await download(wb, `Verkaeufe_${from || 'alle'}_bis_${to || today()}.xlsx`);
}

/** Inventur-Zählliste mit Soll und leerer Ist-Spalte */
export async function exportInventory(rows: StockRow[]) {
  const wb = await newWorkbook();
  const data = rows
    .filter((r) => r.active && (r.condition === 'neu' || r.quantity > 0))
    .map((r) => ({
      kategorie: r.category_name,
      produkt: r.product_name,
      groesse: sizeOf(r.size),
      zustand: CONDITION_LABELS[r.condition],
      soll: r.quantity,
      ist: null,
      differenz: null,
    }));
  const ws = addSheet(
    wb,
    'Inventur',
    [
      { header: 'Kategorie', key: 'kategorie', width: 14 },
      { header: 'Produkt', key: 'produkt', width: 30 },
      { header: 'Größe', key: 'groesse', width: 10 },
      { header: 'Zustand', key: 'zustand', width: 18 },
      { header: 'Soll', key: 'soll', width: 8 },
      { header: 'Ist (gezählt)', key: 'ist', width: 14 },
      { header: 'Differenz', key: 'differenz', width: 11 },
    ],
    data,
    `Inventur Rüsthaus Roßtal – ${formatDate(today())}`,
  );
  // Differenz-Formel und Eingaberahmen
  const first = 5;
  data.forEach((_, i) => {
    const r = first + i;
    ws.getCell(`G${r}`).value = { formula: `IF(F${r}="","",F${r}-E${r})` };
    ws.getCell(`F${r}`).border = {
      top: { style: 'thin' },
      bottom: { style: 'thin' },
      left: { style: 'thin' },
      right: { style: 'thin' },
    };
  });
  const sig = ws.addRow([]);
  sig.height = 10;
  ws.addRow(['Gezählt von:', '', '', 'Datum / Unterschrift:']);
  ws.pageSetup = { orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  await download(wb, `Inventur_${today()}.xlsx`);
}
