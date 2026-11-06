import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Center,
  Group,
  Image,
  Loader,
  Modal,
  Select,
  Stack,
  Switch,
  Textarea,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { IconAlertCircle, IconPhoto, IconUserPlus } from '@tabler/icons-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { CONDITION_COLORS, CONDITION_LABELS, SALE_TYPE_COLORS, SALE_TYPE_LABELS } from '../lib/format';
import { attempt } from '../lib/notify';
import { imageUrl, q, supabase } from '../lib/supabase';
import type { Condition, Member, Product, SaleType, Staff } from '../lib/types';

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <Group justify="space-between" mb="md" wrap="wrap" gap="sm">
      <Title order={2}>{title}</Title>
      {children && <Group gap="xs">{children}</Group>}
    </Group>
  );
}

export function LoadingState({ loading, error, children }: { loading: boolean; error: string | null; children: ReactNode }) {
  if (error)
    return (
      <Alert color="red" icon={<IconAlertCircle />} title="Fehler beim Laden">
        {error}
      </Alert>
    );
  if (loading)
    return (
      <Center py="xl">
        <Loader />
      </Center>
    );
  return <>{children}</>;
}

export function ProductThumb({ product, size = 48 }: { product: Pick<Product, 'product_images'> | null | undefined; size?: number }) {
  const img = product?.product_images?.find((i) => i.is_main) ?? product?.product_images?.[0];
  if (!img) {
    return (
      <Center w={size} h={size} bg="var(--mantine-color-gray-light)" style={{ borderRadius: 8, flexShrink: 0 }}>
        <IconPhoto size={size * 0.45} color="var(--mantine-color-gray-5)" />
      </Center>
    );
  }
  return <Image src={imageUrl(img.path)} w={size} h={size} radius="md" fit="cover" style={{ flexShrink: 0 }} alt="" />;
}

export function ConditionBadge({ condition }: { condition: Condition }) {
  return (
    <Badge variant="light" color={CONDITION_COLORS[condition]} size="sm">
      {CONDITION_LABELS[condition]}
    </Badge>
  );
}

export function SaleTypeBadge({ type }: { type: SaleType }) {
  return (
    <Badge variant="light" color={SALE_TYPE_COLORS[type]}>
      {SALE_TYPE_LABELS[type]}
    </Badge>
  );
}

export function StaffSelect({
  staff,
  value,
  onChange,
  label = 'Ausgeber',
}: {
  staff: Staff[];
  value: string | null;
  onChange: (v: string | null) => void;
  label?: string;
}) {
  const data = staff.filter((s) => s.active || s.id === value).map((s) => ({ value: s.id, label: s.name }));
  return <Select label={label} data={data} value={value} onChange={onChange} required allowDeselect={false} searchable />;
}

/** Mitglieder-Auswahl mit Schnell-Anlage */
export function MemberSelect({
  members,
  value,
  onChange,
  onCreated,
  label = 'Käufer / Mitglied',
  error,
}: {
  members: Member[];
  value: string | null;
  onChange: (v: string | null) => void;
  onCreated: (m: Member) => void;
  label?: string;
  error?: string | null;
}) {
  const [creating, setCreating] = useState(false);
  const data = useMemo(
    () =>
      members
        .filter((m) => m.active || m.id === value)
        .map((m) => ({
          value: m.id,
          label: `${m.first_name} ${m.last_name}`.trim() + (m.group_name ? ` (${m.group_name})` : ''),
        })),
    [members, value],
  );
  return (
    <>
      <Group align="flex-end" gap="xs" wrap="nowrap">
        <Select
          style={{ flex: 1 }}
          label={label}
          placeholder="Name suchen…"
          data={data}
          value={value}
          onChange={onChange}
          searchable
          clearable
          required
          error={error}
          nothingFoundMessage="Nicht gefunden – rechts neu anlegen"
        />
        <Tooltip label="Neues Mitglied anlegen">
          <ActionIcon size="lg" variant="light" onClick={() => setCreating(true)} mb={error ? 22 : 0}>
            <IconUserPlus size={18} />
          </ActionIcon>
        </Tooltip>
      </Group>
      <MemberFormModal
        opened={creating}
        member={null}
        onClose={() => setCreating(false)}
        onSaved={(m) => {
          onCreated(m);
          onChange(m.id);
          setCreating(false);
        }}
      />
    </>
  );
}

export function MemberFormModal({
  opened,
  member,
  onClose,
  onSaved,
}: {
  opened: boolean;
  member: Member | null;
  onClose: () => void;
  onSaved: (m: Member) => void;
}) {
  const empty = { first_name: '', last_name: '', group_name: '', contact: '', notes: '', active: true };
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (opened)
      setForm(
        member
          ? {
              first_name: member.first_name,
              last_name: member.last_name,
              group_name: member.group_name ?? '',
              contact: member.contact ?? '',
              notes: member.notes ?? '',
              active: member.active,
            }
          : empty,
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, member]);

  const save = async () => {
    setBusy(true);
    let saved: Member | null = null;
    const payload = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      group_name: form.group_name.trim() || null,
      contact: form.contact.trim() || null,
      notes: form.notes.trim() || null,
      active: form.active,
    };
    const okay = await attempt(async () => {
      saved = member
        ? await q<Member>(supabase.from('members').update(payload).eq('id', member.id).select().single())
        : await q<Member>(supabase.from('members').insert(payload).select().single());
    }, 'Mitglied gespeichert.');
    setBusy(false);
    if (okay && saved) onSaved(saved);
  };

  return (
    <Modal opened={opened} onClose={onClose} title={member ? 'Mitglied bearbeiten' : 'Neues Mitglied'}>
      <Stack>
        <Group grow>
          <TextInput label="Vorname" required value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.currentTarget.value })} data-autofocus />
          <TextInput label="Nachname" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.currentTarget.value })} />
        </Group>
        <TextInput label="Gruppe / Stufe" placeholder="z. B. Sippe Falken, Meute" value={form.group_name} onChange={(e) => setForm({ ...form, group_name: e.currentTarget.value })} />
        <TextInput label="Kontakt (optional)" placeholder="Telefon / E-Mail der Eltern" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.currentTarget.value })} />
        <Textarea label="Notiz" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.currentTarget.value })} autosize minRows={2} />
        {member && <Switch label="Aktiv" checked={form.active} onChange={(e) => setForm({ ...form, active: e.currentTarget.checked })} />}
        <Button onClick={save} loading={busy} disabled={!form.first_name.trim()}>
          Speichern
        </Button>
      </Stack>
    </Modal>
  );
}
