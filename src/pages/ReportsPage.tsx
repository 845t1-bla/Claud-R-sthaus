import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  NumberInput,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Tabs,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { IconClipboardList, IconDownload, IconFileSpreadsheet, IconReceipt } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { ConditionBadge, LoadingState, PageHeader } from '../components/common';
import { loadSales, loadStock } from '../lib/api';
import { exportInventory, exportSales, exportStock } from '../lib/export';
import { firstOfYear, sizeLabel, today } from '../lib/format';
import { attempt, fail } from '../lib/notify';
import { rpc } from '../lib/supabase';
import { useData } from '../lib/useData';

export default function ReportsPage() {
  return (
    <>
      <PageHeader title="Berichte & Inventur" />
      <Tabs defaultValue="exporte">
        <Tabs.List mb="md">
          <Tabs.Tab value="exporte" leftSection={<IconFileSpreadsheet size={16} />}>
            Excel-Exporte
          </Tabs.Tab>
          <Tabs.Tab value="inventur" leftSection={<IconClipboardList size={16} />}>
            Inventur erfassen
          </Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="exporte">
          <Exports />
        </Tabs.Panel>
        <Tabs.Panel value="inventur">
          <InventoryEntry />
        </Tabs.Panel>
      </Tabs>
    </>
  );
}

function Exports() {
  const [includeZero, setIncludeZero] = useState(false);
  const [from, setFrom] = useState(firstOfYear());
  const [to, setTo] = useState(today());
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (name: string, fn: () => Promise<void>) => {
    setBusy(name);
    try {
      await fn();
    } catch (e) {
      fail(e);
    }
    setBusy(null);
  };

  return (
    <SimpleGrid cols={{ base: 1, md: 3 }}>
      <Card withBorder>
        <Stack>
          <Group gap="xs">
            <IconFileSpreadsheet />
            <Title order={4}>Bestandsliste</Title>
          </Group>
          <Text size="sm" c="dimmed">
            Aktueller Bestand je Produkt, Größe und Zustand inkl. Warenwert und Nachbestell-Hinweis.
          </Text>
          <Switch label="Auch Artikel mit Bestand 0" checked={includeZero} onChange={(e) => setIncludeZero(e.currentTarget.checked)} />
          <Button leftSection={<IconDownload size={16} />} loading={busy === 'stock'} onClick={() => run('stock', async () => exportStock(await loadStock(), includeZero))}>
            Herunterladen
          </Button>
        </Stack>
      </Card>
      <Card withBorder>
        <Stack>
          <Group gap="xs">
            <IconReceipt />
            <Title order={4}>Verkaufsübersicht</Title>
          </Group>
          <Text size="sm" c="dimmed">
            Alle Verkäufe, Kluftflats und Tausche im Zeitraum – mit Positionen, Rabatt-/Gratis-Gründen und Summen je Ausgeber.
          </Text>
          <Group grow>
            <TextInput label="Von" type="date" value={from} onChange={(e) => setFrom(e.currentTarget.value)} />
            <TextInput label="Bis" type="date" value={to} onChange={(e) => setTo(e.currentTarget.value)} />
          </Group>
          <Button leftSection={<IconDownload size={16} />} loading={busy === 'sales'} onClick={() => run('sales', async () => exportSales(await loadSales({ from, to }), from, to))}>
            Herunterladen
          </Button>
        </Stack>
      </Card>
      <Card withBorder>
        <Stack>
          <Group gap="xs">
            <IconClipboardList />
            <Title order={4}>Inventurdatei</Title>
          </Group>
          <Text size="sm" c="dimmed">
            Zählliste mit Soll-Bestand und leerer Spalte „Ist“ zum Ausdrucken oder Ausfüllen. Die Differenz rechnet Excel automatisch.
          </Text>
          <Button leftSection={<IconDownload size={16} />} loading={busy === 'inv'} onClick={() => run('inv', async () => exportInventory(await loadStock()))}>
            Herunterladen
          </Button>
        </Stack>
      </Card>
    </SimpleGrid>
  );
}

function InventoryEntry() {
  const stock = useData(loadStock);
  const [counts, setCounts] = useState<Record<string, number | ''>>({});
  const [note, setNote] = useState(`Inventur ${new Date().toLocaleDateString('de-DE')}`);
  const [onlyDiff, setOnlyDiff] = useState(false);
  const [busy, setBusy] = useState(false);

  const rows = useMemo(
    () => (stock.data ?? []).filter((r) => r.active && (r.condition === 'neu' || r.quantity > 0)),
    [stock.data],
  );
  const k = (v: string, c: string) => `${v}|${c}`;
  const diffs = rows.filter((r) => {
    const c = counts[k(r.variant_id, r.condition)];
    return c !== undefined && c !== '' && c !== r.quantity;
  });
  const entered = Object.values(counts).filter((c) => c !== '').length;
  const visible = onlyDiff ? diffs : rows;

  const submit = () =>
    modals.openConfirmModal({
      title: 'Inventur buchen?',
      children: (
        <Text size="sm">
          {diffs.length} Abweichung(en) werden als Inventurkorrektur gebucht. Nicht ausgefüllte Zeilen bleiben unverändert.
        </Text>
      ),
      labels: { confirm: 'Buchen', cancel: 'Abbrechen' },
      onConfirm: async () => {
        setBusy(true);
        const okay = await attempt(
          () =>
            rpc('apply_inventory', {
              p_note: note,
              p_counts: Object.entries(counts)
                .filter(([, v]) => v !== '')
                .map(([key, counted]) => {
                  const [variant_id, condition] = key.split('|');
                  return { variant_id, condition, counted };
                }),
            }),
          'Inventur gebucht.',
        );
        setBusy(false);
        if (okay) {
          setCounts({});
          void stock.reload();
        }
      },
    });

  return (
    <LoadingState loading={stock.loading} error={stock.error}>
      <Stack>
        <Alert color="blue">
          Gezählte Mengen eintragen. Leere Felder werden nicht verändert. Beim Buchen wird jede Abweichung als „Inventur“ im
          Bestand protokolliert.
        </Alert>
        <Group align="flex-end" wrap="wrap">
          <TextInput label="Bezeichnung" value={note} onChange={(e) => setNote(e.currentTarget.value)} w={260} />
          <Switch label="Nur Abweichungen zeigen" checked={onlyDiff} onChange={(e) => setOnlyDiff(e.currentTarget.checked)} />
          <Button
            variant="default"
            onClick={() => setCounts(Object.fromEntries(rows.map((r) => [k(r.variant_id, r.condition), r.quantity])))}
          >
            Soll als Ist übernehmen
          </Button>
          <Button onClick={submit} loading={busy} disabled={entered === 0}>
            Inventur buchen ({diffs.length} Abweichungen)
          </Button>
        </Group>
        <Table.ScrollContainer minWidth={620}>
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Kategorie</Table.Th>
                <Table.Th>Produkt</Table.Th>
                <Table.Th>Größe</Table.Th>
                <Table.Th>Zustand</Table.Th>
                <Table.Th ta="center">Soll</Table.Th>
                <Table.Th>Ist</Table.Th>
                <Table.Th ta="center">Differenz</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {visible.map((r) => {
                const key = k(r.variant_id, r.condition);
                const c = counts[key];
                const diff = c === undefined || c === '' ? null : Number(c) - r.quantity;
                return (
                  <Table.Tr key={key}>
                    <Table.Td>{r.category_name}</Table.Td>
                    <Table.Td>{r.product_name}</Table.Td>
                    <Table.Td>{sizeLabel(r.size)}</Table.Td>
                    <Table.Td>
                      <ConditionBadge condition={r.condition} />
                    </Table.Td>
                    <Table.Td ta="center">{r.quantity}</Table.Td>
                    <Table.Td>
                      <NumberInput size="xs" w={80} min={0} value={c ?? ''} onChange={(v) => setCounts({ ...counts, [key]: v === '' ? '' : Number(v) })} />
                    </Table.Td>
                    <Table.Td ta="center">
                      {diff !== null && diff !== 0 && (
                        <Badge color={diff < 0 ? 'red' : 'green'} variant="light">
                          {diff > 0 ? `+${diff}` : diff}
                        </Badge>
                      )}
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Stack>
    </LoadingState>
  );
}
