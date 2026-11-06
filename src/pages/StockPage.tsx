import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Modal,
  NumberInput,
  SegmentedControl,
  Select,
  Stack,
  Switch,
  Table,
  Tabs,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { IconAdjustments, IconDownload, IconPlus } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { ConditionBadge, LoadingState, PageHeader } from '../components/common';
import { loadMovements, loadStock } from '../lib/api';
import { exportStock } from '../lib/export';
import { CONDITION_LABELS, CONDITIONS, MOVEMENT_LABELS, euro, formatDateTime, sizeLabel, variantLabel } from '../lib/format';
import { attempt } from '../lib/notify';
import { rpc } from '../lib/supabase';
import type { Condition, StockRow } from '../lib/types';
import { useData } from '../lib/useData';

interface VariantRow {
  variant_id: string;
  product_name: string;
  category_name: string;
  size: string;
  price: number;
  min_stock: number;
  active: boolean;
  qty: Record<Condition, number>;
}

export default function StockPage() {
  const stock = useData(loadStock);
  const movements = useData(() => loadMovements(300));
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [onlyLow, setOnlyLow] = useState(false);
  const [booking, setBooking] = useState<{ row: VariantRow; mode: 'in' | 'adjust' } | null>(null);

  const rows = useMemo(() => {
    const m = new Map<string, VariantRow>();
    (stock.data ?? []).forEach((r: StockRow) => {
      const e =
        m.get(r.variant_id) ??
        ({
          variant_id: r.variant_id,
          product_name: r.product_name,
          category_name: r.category_name,
          size: r.size,
          price: Number(r.price),
          min_stock: r.min_stock,
          active: r.active,
          qty: { neu: 0, gebraucht_flat: 0, haertefall: 0 },
        } as VariantRow);
      e.qty[r.condition] = r.quantity;
      m.set(r.variant_id, e);
    });
    return [...m.values()];
  }, [stock.data]);

  const list = rows.filter(
    (r) =>
      (showInactive || r.active) &&
      (!onlyLow || r.qty.neu < r.min_stock) &&
      `${r.product_name} ${r.category_name} ${r.size}`.toLowerCase().includes(search.toLowerCase()),
  );
  const totalValue = list.reduce((a, r) => a + r.qty.neu * r.price, 0);

  const reload = () => {
    void stock.reload();
    void movements.reload();
  };

  let lastCat = '';
  return (
    <>
      <PageHeader title="Bestand">
        <Button variant="light" leftSection={<IconDownload size={16} />} onClick={() => stock.data && void exportStock(stock.data, false)}>
          Bestandsliste (Excel)
        </Button>
      </PageHeader>
      <Tabs defaultValue="bestand">
        <Tabs.List mb="md">
          <Tabs.Tab value="bestand">Bestand</Tabs.Tab>
          <Tabs.Tab value="bewegungen">Buchungen</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="bestand">
          <Group mb="md" wrap="wrap">
            <TextInput placeholder="Suchen…" value={search} onChange={(e) => setSearch(e.currentTarget.value)} w={220} />
            <Switch label="Nur unter Mindestbestand" checked={onlyLow} onChange={(e) => setOnlyLow(e.currentTarget.checked)} />
            <Switch label="Inaktive anzeigen" checked={showInactive} onChange={(e) => setShowInactive(e.currentTarget.checked)} />
          </Group>
          <LoadingState loading={stock.loading} error={stock.error}>
            <Text size="sm" c="dimmed" mb="xs">
              Warenwert (neu, zu Verkaufspreisen): <b>{euro(totalValue)}</b>
            </Text>
            <Table.ScrollContainer minWidth={680}>
              <Table striped>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Produkt</Table.Th>
                    <Table.Th>Größe</Table.Th>
                    <Table.Th ta="center">Neu</Table.Th>
                    <Table.Th ta="center">Gebraucht (Flat)</Table.Th>
                    <Table.Th ta="center">Härtefall</Table.Th>
                    <Table.Th ta="center">Min.</Table.Th>
                    <Table.Th />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {list.flatMap((r) => {
                    const out = [];
                    if (r.category_name !== lastCat) {
                      lastCat = r.category_name;
                      out.push(
                        <Table.Tr key={`cat-${r.category_name}-${r.variant_id}`}>
                          <Table.Td colSpan={7} fw={700} bg="var(--mantine-color-default-hover)">
                            {r.category_name}
                          </Table.Td>
                        </Table.Tr>,
                      );
                    }
                    const low = r.active && r.qty.neu < r.min_stock;
                    out.push(
                      <Table.Tr key={r.variant_id} opacity={r.active ? 1 : 0.5}>
                        <Table.Td>{r.product_name}</Table.Td>
                        <Table.Td>{sizeLabel(r.size) || '–'}</Table.Td>
                        <Table.Td ta="center">
                          {low ? (
                            <Badge color="red" variant="light">
                              {r.qty.neu}
                            </Badge>
                          ) : (
                            r.qty.neu
                          )}
                        </Table.Td>
                        <Table.Td ta="center">{r.qty.gebraucht_flat || ''}</Table.Td>
                        <Table.Td ta="center">{r.qty.haertefall || ''}</Table.Td>
                        <Table.Td ta="center">{r.min_stock || ''}</Table.Td>
                        <Table.Td>
                          <Group gap={4} justify="flex-end" wrap="nowrap">
                            <Tooltip label="Wareneingang">
                              <ActionIcon variant="light" color="green" onClick={() => setBooking({ row: r, mode: 'in' })}>
                                <IconPlus size={16} />
                              </ActionIcon>
                            </Tooltip>
                            <Tooltip label="Korrektur / Entsorgung">
                              <ActionIcon variant="light" onClick={() => setBooking({ row: r, mode: 'adjust' })}>
                                <IconAdjustments size={16} />
                              </ActionIcon>
                            </Tooltip>
                          </Group>
                        </Table.Td>
                      </Table.Tr>,
                    );
                    return out;
                  })}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </LoadingState>
        </Tabs.Panel>
        <Tabs.Panel value="bewegungen">
          <LoadingState loading={movements.loading} error={movements.error}>
            <Text size="sm" c="dimmed" mb="xs">
              Die letzten 300 Bestandsbuchungen.
            </Text>
            <Table.ScrollContainer minWidth={760}>
              <Table striped>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Zeit</Table.Th>
                    <Table.Th>Art</Table.Th>
                    <Table.Th>Artikel</Table.Th>
                    <Table.Th>Zustand</Table.Th>
                    <Table.Th ta="right">Menge</Table.Th>
                    <Table.Th>Ausgeber</Table.Th>
                    <Table.Th>Grund</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {(movements.data ?? []).map((m) => (
                    <Table.Tr key={m.id}>
                      <Table.Td>{formatDateTime(m.created_at)}</Table.Td>
                      <Table.Td>{MOVEMENT_LABELS[m.kind] ?? m.kind}</Table.Td>
                      <Table.Td>{variantLabel(m.variants)}</Table.Td>
                      <Table.Td>
                        <ConditionBadge condition={m.condition} />
                      </Table.Td>
                      <Table.Td ta="right" c={m.delta < 0 ? 'red' : 'green'} fw={500}>
                        {m.delta > 0 ? `+${m.delta}` : m.delta}
                      </Table.Td>
                      <Table.Td>{m.staff?.name}</Table.Td>
                      <Table.Td>{m.reason}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </LoadingState>
        </Tabs.Panel>
      </Tabs>
      <BookingModal
        booking={booking}
        onClose={() => setBooking(null)}
        onDone={() => {
          setBooking(null);
          reload();
        }}
      />
    </>
  );
}

function BookingModal({
  booking,
  onClose,
  onDone,
}: {
  booking: { row: VariantRow; mode: 'in' | 'adjust' } | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [condition, setCondition] = useState<Condition>('neu');
  const [qty, setQty] = useState<number>(1);
  const [kind, setKind] = useState<'korrektur' | 'entsorgung'>('korrektur');
  const [direction, setDirection] = useState<'plus' | 'minus'>('minus');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setCondition('neu');
    setQty(1);
    setKind('korrektur');
    setDirection('minus');
    setReason('');
  };

  if (!booking) return <Modal opened={false} onClose={onClose} />;
  const { row, mode } = booking;
  const isIn = mode === 'in';
  const delta = isIn ? qty : kind === 'entsorgung' || direction === 'minus' ? -qty : qty;

  const submit = async () => {
    setBusy(true);
    const okay = await attempt(
      () =>
        rpc('adjust_stock', {
          p_variant: row.variant_id,
          p_condition: condition,
          p_delta: delta,
          p_kind: isIn ? 'wareneingang' : kind,
          p_reason: reason,
        }),
      'Buchung gespeichert.',
    );
    setBusy(false);
    if (okay) {
      reset();
      onDone();
    }
  };

  return (
    <Modal
      opened
      onClose={() => {
        reset();
        onClose();
      }}
      title={`${isIn ? 'Wareneingang' : 'Korrektur / Entsorgung'}: ${row.product_name} ${sizeLabel(row.size)}`}
    >
      <Stack>
        <Select
          label="Zustand"
          data={CONDITIONS.map((c) => ({ value: c, label: `${CONDITION_LABELS[c]} (aktuell ${row.qty[c]})` }))}
          value={condition}
          onChange={(v) => setCondition((v as Condition) ?? 'neu')}
          allowDeselect={false}
        />
        {!isIn && (
          <SegmentedControl
            value={kind}
            onChange={(v) => setKind(v as 'korrektur' | 'entsorgung')}
            data={[
              { value: 'korrektur', label: 'Korrektur' },
              { value: 'entsorgung', label: 'Entsorgung' },
            ]}
          />
        )}
        {!isIn && kind === 'korrektur' && (
          <SegmentedControl
            value={direction}
            onChange={(v) => setDirection(v as 'plus' | 'minus')}
            data={[
              { value: 'minus', label: '− abziehen' },
              { value: 'plus', label: '+ hinzufügen' },
            ]}
          />
        )}
        <NumberInput label="Menge" min={1} value={qty} onChange={(v) => setQty(Math.max(1, Number(v || 1)))} />
        <TextInput
          label={isIn ? 'Notiz (optional)' : 'Grund'}
          required={!isIn}
          placeholder={isIn ? 'z. B. Lieferung Rüsthaus Bundesebene' : 'z. B. Zählfehler, Mottenfraß'}
          value={reason}
          onChange={(e) => setReason(e.currentTarget.value)}
        />
        <Text size="sm">
          Neuer Bestand: <b>{row.qty[condition] + delta}</b>
        </Text>
        <Button onClick={submit} loading={busy} disabled={(!isIn && !reason.trim()) || row.qty[condition] + delta < 0}>
          Buchen
        </Button>
      </Stack>
    </Modal>
  );
}
