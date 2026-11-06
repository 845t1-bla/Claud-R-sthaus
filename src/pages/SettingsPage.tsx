import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Checkbox,
  Group,
  Modal,
  NumberInput,
  Paper,
  Select,
  Stack,
  Switch,
  Table,
  Tabs,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { IconArrowDown, IconArrowUp, IconEdit, IconPlus, IconTrash } from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';
import { LoadingState, PageHeader, ProductThumb } from '../components/common';
import { loadCategories, loadFlatPatchDefaults, loadFlatPrice, loadProducts, loadStaff } from '../lib/api';
import { useAuth } from '../lib/auth';
import { sizeLabel } from '../lib/format';
import { attempt } from '../lib/notify';
import { q, supabase } from '../lib/supabase';
import type { Category, Staff } from '../lib/types';
import { useData } from '../lib/useData';

export default function SettingsPage() {
  const { isAdmin } = useAuth();
  return (
    <>
      <PageHeader title="Einstellungen" />
      <Tabs defaultValue="flat">
        <Tabs.List mb="md">
          <Tabs.Tab value="flat">Kluftflat</Tabs.Tab>
          <Tabs.Tab value="kategorien">Kategorien</Tabs.Tab>
          <Tabs.Tab value="ausgeber">Ausgeber</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="flat">
          <Stack maw={760}>
            <FlatPriceSetting isAdmin={isAdmin} />
            <FlatPatches />
          </Stack>
        </Tabs.Panel>
        <Tabs.Panel value="kategorien">
          <Categories />
        </Tabs.Panel>
        <Tabs.Panel value="ausgeber">
          <StaffAdmin isAdmin={isAdmin} />
        </Tabs.Panel>
      </Tabs>
    </>
  );
}

function FlatPriceSetting({ isAdmin }: { isAdmin: boolean }) {
  const price = useData(loadFlatPrice);
  const [value, setValue] = useState<number | ''>('');
  useEffect(() => {
    if (price.data != null) setValue(price.data);
  }, [price.data]);

  return (
    <Paper withBorder p="md">
      <Title order={5} mb="xs">
        Preis der Kluftflat
      </Title>
      <Group align="flex-end">
        <NumberInput min={0} decimalScale={2} decimalSeparator="," suffix=" €" value={value} onChange={(v) => setValue(v === '' ? '' : Number(v))} disabled={!isAdmin} w={160} />
        <Button
          disabled={!isAdmin || value === '' || value === price.data}
          onClick={() =>
            void attempt(() => q(supabase.from('settings').upsert({ key: 'flat_price', value: Number(value) })), 'Preis gespeichert.').then(
              () => price.reload(),
            )
          }
        >
          Speichern
        </Button>
      </Group>
      {!isAdmin && (
        <Text size="xs" c="dimmed" mt={4}>
          Nur Admins können den Preis ändern.
        </Text>
      )}
    </Paper>
  );
}

function FlatPatches() {
  const patches = useData(loadFlatPatchDefaults);
  const products = useData(loadProducts);
  const [adding, setAdding] = useState<string | null>(null);

  const variantInfo = useMemo(() => {
    const m = new Map<string, { label: string; product: (typeof products.data & object)[number] }>();
    (products.data ?? []).forEach((p) =>
      p.variants.forEach((v) => m.set(v.id, { label: `${p.name} ${sizeLabel(v.size)}`.trim(), product: p })),
    );
    return m;
  }, [products.data]);

  const options = (products.data ?? [])
    .filter((p) => p.active && !p.categories?.is_kluft)
    .flatMap((p) =>
      p.variants
        .filter((v) => v.active && !(patches.data ?? []).some((x) => x.variant_id === v.id))
        .map((v) => ({ value: v.id, label: `${p.name} ${sizeLabel(v.size)}`.trim(), group: p.categories?.name ?? '' })),
    );
  const grouped = Object.entries(
    options.reduce<Record<string, { value: string; label: string }[]>>((acc, o) => {
      (acc[o.group] ??= []).push({ value: o.value, label: o.label });
      return acc;
    }, {}),
  ).map(([group, items]) => ({ group, items }));

  const list = patches.data ?? [];

  const add = async () => {
    if (!adding) return;
    if (await attempt(() => q(supabase.from('flat_patch_defaults').insert({ variant_id: adding, quantity: 1, sort: list.length + 1 })), 'Aufnäher hinzugefügt.')) {
      setAdding(null);
      void patches.reload();
    }
  };

  const move = async (idx: number, dir: -1 | 1) => {
    const a = list[idx];
    const b = list[idx + dir];
    if (!a || !b) return;
    await attempt(async () => {
      await q(supabase.from('flat_patch_defaults').update({ sort: idx + dir + 1 }).eq('id', a.id));
      await q(supabase.from('flat_patch_defaults').update({ sort: idx + 1 }).eq('id', b.id));
    });
    void patches.reload();
  };

  return (
    <Paper withBorder p="md">
      <Title order={5}>Standard-Aufnäher der Kluftflat</Title>
      <Text size="sm" c="dimmed" mb="sm">
        Diese Aufnäher sind bei jeder Flat-Ausgabe vorausgewählt und können dort einzeln abgewählt werden.
      </Text>
      <LoadingState loading={patches.loading || products.loading} error={patches.error ?? products.error}>
        <Stack gap="xs">
          {list.map((p, i) => {
            const info = variantInfo.get(p.variant_id);
            return (
              <Group key={p.id} wrap="nowrap">
                <ProductThumb product={info?.product} size={36} />
                <Text style={{ flex: 1 }}>{info?.label ?? '?'}</Text>
                <NumberInput
                  size="xs"
                  w={70}
                  min={1}
                  value={p.quantity}
                  onChange={(v) => {
                    const n = Math.max(1, Number(v || 1));
                    patches.setData(list.map((x) => (x.id === p.id ? { ...x, quantity: n } : x)));
                    void supabase.from('flat_patch_defaults').update({ quantity: n }).eq('id', p.id);
                  }}
                />
                <ActionIcon variant="subtle" disabled={i === 0} onClick={() => void move(i, -1)}>
                  <IconArrowUp size={16} />
                </ActionIcon>
                <ActionIcon variant="subtle" disabled={i === list.length - 1} onClick={() => void move(i, 1)}>
                  <IconArrowDown size={16} />
                </ActionIcon>
                <ActionIcon
                  variant="subtle"
                  color="red"
                  onClick={async () => {
                    if (await attempt(() => q(supabase.from('flat_patch_defaults').delete().eq('id', p.id)))) void patches.reload();
                  }}
                >
                  <IconTrash size={16} />
                </ActionIcon>
              </Group>
            );
          })}
          {list.length === 0 && <Text size="sm" c="dimmed">Noch keine Standard-Aufnäher.</Text>}
          <Group align="flex-end" mt="xs">
            <Select placeholder="Artikel wählen…" searchable data={grouped} value={adding} onChange={setAdding} style={{ flex: 1 }} />
            <Button leftSection={<IconPlus size={16} />} onClick={add} disabled={!adding}>
              Hinzufügen
            </Button>
          </Group>
        </Stack>
      </LoadingState>
    </Paper>
  );
}

function Categories() {
  const cats = useData(loadCategories);
  const [editing, setEditing] = useState<Category | 'new' | null>(null);
  const [name, setName] = useState('');
  const [isKluft, setIsKluft] = useState(false);
  const [sort, setSort] = useState(0);

  const open = (c: Category | 'new') => {
    setEditing(c);
    setName(c === 'new' ? '' : c.name);
    setIsKluft(c === 'new' ? false : c.is_kluft);
    setSort(c === 'new' ? (cats.data?.length ?? 0) + 1 : c.sort);
  };

  const save = async () => {
    const payload = { name: name.trim(), is_kluft: isKluft, sort };
    const okay = await attempt(
      () =>
        editing === 'new'
          ? q(supabase.from('categories').insert(payload))
          : q(supabase.from('categories').update(payload).eq('id', (editing as Category).id)),
      'Kategorie gespeichert.',
    );
    if (okay) {
      setEditing(null);
      void cats.reload();
    }
  };

  return (
    <Stack maw={640}>
      <Group justify="flex-end">
        <Button leftSection={<IconPlus size={16} />} onClick={() => open('new')}>
          Neue Kategorie
        </Button>
      </Group>
      <LoadingState loading={cats.loading} error={cats.error}>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Reihenfolge</Table.Th>
              <Table.Th>Name</Table.Th>
              <Table.Th>Kluftflat</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {(cats.data ?? []).map((c) => (
              <Table.Tr key={c.id}>
                <Table.Td>{c.sort}</Table.Td>
                <Table.Td>{c.name}</Table.Td>
                <Table.Td>{c.is_kluft && <Badge variant="light">Kluft</Badge>}</Table.Td>
                <Table.Td>
                  <Group gap={4} justify="flex-end">
                    <ActionIcon variant="subtle" onClick={() => open(c)}>
                      <IconEdit size={16} />
                    </ActionIcon>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      onClick={() =>
                        modals.openConfirmModal({
                          title: `Kategorie „${c.name}“ löschen?`,
                          labels: { confirm: 'Löschen', cancel: 'Abbrechen' },
                          confirmProps: { color: 'red' },
                          onConfirm: async () => {
                            if (await attempt(() => q(supabase.from('categories').delete().eq('id', c.id)), 'Kategorie gelöscht.')) void cats.reload();
                          },
                        })
                      }
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </LoadingState>
      <Modal opened={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'Neue Kategorie' : 'Kategorie bearbeiten'}>
        <Stack>
          <TextInput label="Name" required value={name} onChange={(e) => setName(e.currentTarget.value)} />
          <NumberInput label="Reihenfolge" value={sort} onChange={(v) => setSort(Number(v || 0))} />
          <Checkbox
            label="Kluft-Kategorie (Produkte können per Kluftflat ausgegeben werden)"
            checked={isKluft}
            onChange={(e) => setIsKluft(e.currentTarget.checked)}
          />
          <Button onClick={save} disabled={!name.trim()}>
            Speichern
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}

function StaffAdmin({ isAdmin }: { isAdmin: boolean }) {
  const staff = useData(loadStaff);
  const { staff: me, refreshStaff } = useAuth();
  const [editing, setEditing] = useState<Staff | 'new' | null>(null);
  const [form, setForm] = useState({ name: '', email: '', role: 'ausgeber' as Staff['role'], active: true });

  const open = (s: Staff | 'new') => {
    setEditing(s);
    setForm(s === 'new' ? { name: '', email: '', role: 'ausgeber', active: true } : { name: s.name, email: s.email ?? '', role: s.role, active: s.active });
  };

  const save = async () => {
    const payload = { name: form.name.trim(), email: form.email.trim().toLowerCase() || null, role: form.role, active: form.active };
    const okay = await attempt(
      () =>
        editing === 'new'
          ? q(supabase.from('staff').insert(payload))
          : q(supabase.from('staff').update(payload).eq('id', (editing as Staff).id)),
      'Ausgeber gespeichert.',
    );
    if (okay) {
      setEditing(null);
      void staff.reload();
      void refreshStaff();
    }
  };

  return (
    <Stack maw={800}>
      <Alert color="blue">
        <Text size="sm">
          Neue Personen: hier mit Name und E-Mail anlegen, dann im Supabase-Dashboard unter <b>Authentication → Users → Add user</b> mit
          derselben E-Mail ein Login erstellen (oder einladen). Das Login wird automatisch verknüpft. Personen ohne Login können trotzdem
          bei Verkäufen als Ausgeber ausgewählt werden.
        </Text>
      </Alert>
      {isAdmin && (
        <Group justify="flex-end">
          <Button leftSection={<IconPlus size={16} />} onClick={() => open('new')}>
            Ausgeber anlegen
          </Button>
        </Group>
      )}
      <LoadingState loading={staff.loading} error={staff.error}>
        <Table.ScrollContainer minWidth={560}>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>E-Mail</Table.Th>
                <Table.Th>Rolle</Table.Th>
                <Table.Th>Login</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {(staff.data ?? []).map((s) => (
                <Table.Tr key={s.id} opacity={s.active ? 1 : 0.55}>
                  <Table.Td fw={500}>{s.name}</Table.Td>
                  <Table.Td>{s.email}</Table.Td>
                  <Table.Td>{s.role === 'admin' ? <Badge>Admin</Badge> : 'Ausgeber'}</Table.Td>
                  <Table.Td>{s.user_id ? <Badge color="green" variant="light">verknüpft</Badge> : <Text size="xs" c="dimmed">kein Login</Text>}</Table.Td>
                  <Table.Td>{s.active ? 'aktiv' : <Badge color="orange" variant="light">inaktiv / nicht freigeschaltet</Badge>}</Table.Td>
                  <Table.Td>
                    {isAdmin && (
                      <ActionIcon variant="subtle" onClick={() => open(s)}>
                        <IconEdit size={16} />
                      </ActionIcon>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </LoadingState>
      <Modal opened={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'Ausgeber anlegen' : 'Ausgeber bearbeiten'}>
        <Stack>
          <TextInput label="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.currentTarget.value })} />
          <TextInput label="E-Mail (für Login)" value={form.email} onChange={(e) => setForm({ ...form, email: e.currentTarget.value })} />
          <Select
            label="Rolle"
            data={[
              { value: 'ausgeber', label: 'Ausgeber' },
              { value: 'admin', label: 'Admin (darf Ausgeber & Einstellungen verwalten)' },
            ]}
            value={form.role}
            onChange={(v) => setForm({ ...form, role: (v as Staff['role']) ?? 'ausgeber' })}
            allowDeselect={false}
            disabled={editing !== 'new' && (editing as Staff)?.id === me?.id}
          />
          <Switch
            label="Aktiv / freigeschaltet"
            checked={form.active}
            onChange={(e) => setForm({ ...form, active: e.currentTarget.checked })}
            disabled={editing !== 'new' && (editing as Staff)?.id === me?.id}
          />
          <Button onClick={save} disabled={!form.name.trim()}>
            Speichern
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}

