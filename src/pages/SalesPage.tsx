import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Divider,
  Drawer,
  Group,
  NumberInput,
  Paper,
  Select,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { IconDownload, IconGift, IconPercentage } from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';
import { ConditionBadge, LoadingState, MemberSelect, PageHeader, SaleTypeBadge, StaffSelect } from '../components/common';
import { loadMembers, loadSales, loadStaff } from '../lib/api';
import { exportSales } from '../lib/export';
import {
  PAYMENT_OPTIONS,
  SALE_TYPE_LABELS,
  euro,
  firstOfYear,
  formatDate,
  formatDateTime,
  memberName,
  paymentLabel,
  today,
  variantLabel,
} from '../lib/format';
import { attempt } from '../lib/notify';
import { rpc } from '../lib/supabase';
import type { Sale } from '../lib/types';
import { useData } from '../lib/useData';

const hasDiscount = (s: Sale) =>
  s.sale_items.some((i) => !i.is_flat_component && Number(i.unit_price) < Number(i.list_price)) || !!s.fee_reason;

export default function SalesPage() {
  const [from, setFrom] = useState(firstOfYear());
  const [to, setTo] = useState(today());
  const sales = useData(() => loadSales({ from, to }), [from, to]);
  const staff = useData(loadStaff);
  const [staffFilter, setStaffFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [onlyDiscount, setOnlyDiscount] = useState(false);
  const [showCancelled, setShowCancelled] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const list = useMemo(
    () =>
      (sales.data ?? []).filter(
        (s) =>
          (!staffFilter || s.staff_id === staffFilter) &&
          (!typeFilter || s.type === typeFilter) &&
          (!onlyDiscount || hasDiscount(s)) &&
          (showCancelled || !s.cancelled) &&
          `${memberName(s.members)} ${s.members?.group_name ?? ''} ${s.note ?? ''}`.toLowerCase().includes(search.toLowerCase()),
      ),
    [sales.data, staffFilter, typeFilter, onlyDiscount, showCancelled, search],
  );
  const sum = list.filter((s) => !s.cancelled).reduce((a, s) => a + Number(s.total), 0);
  const selected = (sales.data ?? []).find((s) => s.id === selectedId) ?? null;

  return (
    <>
      <PageHeader title="Verkäufe">
        <Button variant="light" leftSection={<IconDownload size={16} />} onClick={() => void exportSales(list, from, to)}>
          Excel-Export
        </Button>
      </PageHeader>
      <Group mb="md" gap="sm" align="flex-end" wrap="wrap">
        <TextInput label="Von" type="date" value={from} onChange={(e) => setFrom(e.currentTarget.value)} />
        <TextInput label="Bis" type="date" value={to} onChange={(e) => setTo(e.currentTarget.value)} />
        <Select
          label="Ausgeber"
          clearable
          placeholder="Alle"
          data={(staff.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
          value={staffFilter}
          onChange={setStaffFilter}
          w={170}
        />
        <Select
          label="Art"
          clearable
          placeholder="Alle"
          data={Object.entries(SALE_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
          value={typeFilter}
          onChange={setTypeFilter}
          w={150}
        />
        <TextInput label="Käufer" placeholder="Name…" value={search} onChange={(e) => setSearch(e.currentTarget.value)} w={170} />
        <Stack gap={4}>
          <Checkbox label="Nur Rabatt/Gratis" checked={onlyDiscount} onChange={(e) => setOnlyDiscount(e.currentTarget.checked)} />
          <Checkbox label="Stornierte zeigen" checked={showCancelled} onChange={(e) => setShowCancelled(e.currentTarget.checked)} />
        </Stack>
      </Group>
      <LoadingState loading={sales.loading} error={sales.error}>
        <Text size="sm" c="dimmed" mb="xs">
          {list.length} Vorgänge · Einnahmen (ohne Stornos): <b>{euro(sum)}</b>
        </Text>
        <Table.ScrollContainer minWidth={760}>
          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Datum</Table.Th>
                <Table.Th>Art</Table.Th>
                <Table.Th>Käufer</Table.Th>
                <Table.Th>Artikel</Table.Th>
                <Table.Th>Ausgeber</Table.Th>
                <Table.Th ta="right">Summe</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {list.map((s) => (
                <Table.Tr key={s.id} className={`clickable-row ${s.cancelled ? 'cancelled-row' : ''}`} onClick={() => setSelectedId(s.id)}>
                  <Table.Td>{formatDate(s.sale_date)}</Table.Td>
                  <Table.Td>
                    <SaleTypeBadge type={s.type} />
                  </Table.Td>
                  <Table.Td>{memberName(s.members)}</Table.Td>
                  <Table.Td>
                    <Text size="sm" lineClamp={1}>
                      {s.sale_items.map((i) => `${i.quantity}× ${variantLabel(i.variants)}`).join(', ')}
                    </Text>
                  </Table.Td>
                  <Table.Td>{s.staff?.name}</Table.Td>
                  <Table.Td ta="right">
                    <Group gap={4} justify="flex-end" wrap="nowrap">
                      {hasDiscount(s) && (
                        <Tooltip label="Enthält Rabatt/Gratis">
                          <IconPercentage size={14} color="var(--mantine-color-grape-6)" />
                        </Tooltip>
                      )}
                      {euro(s.total)}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
        {list.length === 0 && <Text c="dimmed">Keine Verkäufe im Zeitraum.</Text>}
      </LoadingState>
      <SaleDrawer sale={selected} onClose={() => setSelectedId(null)} onChanged={() => void sales.reload()} />
    </>
  );
}

interface ItemDraft {
  id: string;
  quantity: number;
  unit_price: number;
  reason: string;
}

function SaleDrawer({ sale, onClose, onChanged }: { sale: Sale | null; onClose: () => void; onChanged: () => void }) {
  const members = useData(loadMembers);
  const staff = useData(loadStaff);
  const [editing, setEditing] = useState(false);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [payment, setPayment] = useState('bar');
  const [date, setDate] = useState('');
  const [note, setNote] = useState('');
  const [fee, setFee] = useState<number>(0);
  const [feeReason, setFeeReason] = useState('');
  const [items, setItems] = useState<ItemDraft[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!sale) return;
    setEditing(false);
    setMemberId(sale.member_id);
    setStaffId(sale.staff_id);
    setPayment(sale.payment);
    setDate(sale.sale_date);
    setNote(sale.note ?? '');
    setFee(Number(sale.flat_fee));
    setFeeReason(sale.fee_reason ?? '');
    setItems(sale.sale_items.map((i) => ({ id: i.id, quantity: i.quantity, unit_price: Number(i.unit_price), reason: i.reason ?? '' })));
  }, [sale]);

  if (!sale) return <Drawer opened={false} onClose={onClose} />;

  const draft = (id: string) => items.find((i) => i.id === id)!;
  const setDraft = (id: string, patch: Partial<ItemDraft>) => setItems(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const missingReason = sale.sale_items.some((i) => {
    const d = draft(i.id);
    return d && !i.is_flat_component && d.quantity > 0 && d.unit_price < Number(i.list_price) && !d.reason.trim();
  });

  const save = async () => {
    setBusy(true);
    const okay = await attempt(
      () =>
        rpc('update_sale', {
          p_sale: sale.id,
          p_member: memberId,
          p_staff: staffId,
          p_payment: payment,
          p_note: note,
          p_date: date || null,
          p_items: items,
          p_fee: sale.type === 'flat_ausgabe' ? fee : null,
          p_fee_reason: sale.type === 'flat_ausgabe' ? feeReason : null,
        }),
      'Verkauf aktualisiert.',
    );
    setBusy(false);
    if (okay) {
      setEditing(false);
      onChanged();
    }
  };

  const cancel = () => {
    let reason = '';
    modals.openConfirmModal({
      title: 'Verkauf stornieren?',
      children: (
        <Stack>
          <Text size="sm">Alle Artikel werden wieder in den Bestand gebucht. Der Verkauf bleibt als „storniert“ sichtbar.</Text>
          <TextInput label="Grund" required onChange={(e) => (reason = e.currentTarget.value)} data-autofocus />
        </Stack>
      ),
      labels: { confirm: 'Stornieren', cancel: 'Abbrechen' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        if (await attempt(() => rpc('cancel_sale', { p_sale: sale.id, p_reason: reason }), 'Verkauf storniert.')) onChanged();
      },
    });
  };

  return (
    <Drawer opened={!!sale} onClose={onClose} position="right" size="lg" title={<Group gap="xs"><SaleTypeBadge type={sale.type} /> {formatDate(sale.sale_date)}</Group>}>
      <Stack>
        {sale.cancelled && (
          <Alert color="red" title="Storniert">
            {formatDateTime(sale.cancelled_at)} – {sale.cancel_reason}
          </Alert>
        )}

        {editing ? (
          <>
            <MemberSelect members={members.data ?? []} value={memberId} onChange={setMemberId} onCreated={(m) => members.setData([...(members.data ?? []), m])} />
            <Group grow>
              <StaffSelect staff={staff.data ?? []} value={staffId} onChange={setStaffId} />
              <Select label="Zahlung" data={PAYMENT_OPTIONS} value={payment} onChange={(v) => setPayment(v ?? 'bar')} allowDeselect={false} />
              <TextInput label="Datum" type="date" value={date} onChange={(e) => setDate(e.currentTarget.value)} />
            </Group>
            <Textarea label="Notiz" value={note} onChange={(e) => setNote(e.currentTarget.value)} autosize />
          </>
        ) : (
          <Paper withBorder p="sm">
            <Stack gap={4}>
              <Text size="sm">
                <b>Käufer:</b> {memberName(sale.members)} {sale.members?.group_name && `(${sale.members.group_name})`}
              </Text>
              <Text size="sm">
                <b>Ausgeber:</b> {sale.staff?.name}
              </Text>
              <Text size="sm">
                <b>Zahlung:</b> {paymentLabel(sale.payment)}
              </Text>
              {sale.note && (
                <Text size="sm">
                  <b>Notiz:</b> {sale.note}
                </Text>
              )}
              <Text size="xs" c="dimmed">
                Erfasst {formatDateTime(sale.created_at)}
              </Text>
            </Stack>
          </Paper>
        )}

        <Title order={5}>Positionen</Title>
        <Stack gap="xs">
          {sale.sale_items.map((i) => {
            const d = draft(i.id);
            const discounted = !i.is_flat_component && (editing ? d?.unit_price : Number(i.unit_price)) < Number(i.list_price);
            return (
              <Paper key={i.id} withBorder p="xs" opacity={editing && d?.quantity === 0 ? 0.4 : 1}>
                <Group justify="space-between" wrap="nowrap">
                  <Stack gap={2}>
                    <Group gap="xs">
                      <Text size="sm" fw={500}>
                        {variantLabel(i.variants)}
                      </Text>
                      {i.condition !== 'neu' && <ConditionBadge condition={i.condition} />}
                      {i.is_flat_component && (
                        <Badge size="xs" color="grape" variant="light">
                          Flat
                        </Badge>
                      )}
                    </Group>
                    {!editing && (
                      <Text size="xs" c="dimmed">
                        {i.quantity} × {euro(i.unit_price)}
                        {Number(i.unit_price) < Number(i.list_price) && !i.is_flat_component && ` (Liste ${euro(i.list_price)})`}
                        {i.reason && ` – Grund: ${i.reason}`}
                      </Text>
                    )}
                  </Stack>
                  {!editing && <Text size="sm">{euro(i.quantity * Number(i.unit_price))}</Text>}
                </Group>
                {editing && d && (
                  <Stack gap={4} mt={4}>
                    <Group gap="xs" align="flex-end">
                      <NumberInput size="xs" label="Menge" w={80} min={i.is_flat_kluft ? 1 : 0} max={i.is_flat_kluft ? 1 : undefined} value={d.quantity} onChange={(v) => setDraft(i.id, { quantity: Number(v || 0) })} />
                      {!i.is_flat_component && (
                        <>
                          <NumberInput size="xs" label={`Preis (Liste ${euro(i.list_price)})`} w={140} min={0} decimalScale={2} decimalSeparator="," value={d.unit_price} onChange={(v) => setDraft(i.id, { unit_price: Number(v || 0) })} />
                          <Tooltip label="Kostenlos">
                            <Button size="xs" variant="light" color="grape" onClick={() => setDraft(i.id, { unit_price: 0 })}>
                              <IconGift size={14} />
                            </Button>
                          </Tooltip>
                        </>
                      )}
                    </Group>
                    {discounted && (
                      <TextInput size="xs" label="Grund" required value={d.reason} onChange={(e) => setDraft(i.id, { reason: e.currentTarget.value })} error={!d.reason.trim() ? 'Pflichtfeld' : null} />
                    )}
                    {d.quantity === 0 && <Text size="xs" c="red">Position wird entfernt und zurück in den Bestand gebucht.</Text>}
                  </Stack>
                )}
              </Paper>
            );
          })}
        </Stack>

        {sale.type === 'flat_ausgabe' && (
          editing ? (
            <Group grow align="flex-start">
              <NumberInput label="Flat-Betrag" min={0} decimalScale={2} decimalSeparator="," suffix=" €" value={fee} onChange={(v) => setFee(Number(v || 0))} />
              <TextInput label="Grund (bei Ermäßigung)" value={feeReason} onChange={(e) => setFeeReason(e.currentTarget.value)} />
            </Group>
          ) : (
            <Text size="sm">
              Flat-Betrag: <b>{euro(sale.flat_fee)}</b>
              {sale.fee_reason && ` – Grund: ${sale.fee_reason}`}
            </Text>
          )
        )}

        <Group justify="space-between">
          <Text fw={700}>Summe</Text>
          <Text fw={700}>{euro(sale.total)}</Text>
        </Group>

        {!sale.cancelled && (
          <Group justify="space-between">
            <Button variant="subtle" color="red" onClick={cancel}>
              Stornieren
            </Button>
            {editing ? (
              <Group>
                <Button variant="default" onClick={() => setEditing(false)}>
                  Abbrechen
                </Button>
                <Button onClick={save} loading={busy} disabled={missingReason || !memberId}>
                  Speichern
                </Button>
              </Group>
            ) : (
              <Button onClick={() => setEditing(true)}>Bearbeiten</Button>
            )}
          </Group>
        )}

        {(sale.sale_changes ?? []).length > 0 && (
          <>
            <Divider label="Änderungsprotokoll" />
            {[...(sale.sale_changes ?? [])]
              .sort((a, b) => a.changed_at.localeCompare(b.changed_at))
              .map((c) => (
                <Text key={c.id} size="xs" c="dimmed">
                  {formatDateTime(c.changed_at)} · {c.staff?.name}: {c.description}
                </Text>
              ))}
          </>
        )}
      </Stack>
    </Drawer>
  );
}
