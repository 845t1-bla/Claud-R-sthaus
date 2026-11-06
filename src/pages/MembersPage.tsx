import { ActionIcon, Badge, Button, Drawer, Group, Stack, Switch, Table, Text, TextInput, Title } from '@mantine/core';
import { modals } from '@mantine/modals';
import { IconEdit, IconPlus, IconTrash } from '@tabler/icons-react';
import { useState } from 'react';
import { LoadingState, MemberFormModal, PageHeader, SaleTypeBadge } from '../components/common';
import { loadContracts, loadMembers, loadSales } from '../lib/api';
import { euro, formatDate, memberName, variantLabel } from '../lib/format';
import { attempt } from '../lib/notify';
import { q, supabase } from '../lib/supabase';
import type { Member } from '../lib/types';
import { useData } from '../lib/useData';

export default function MembersPage() {
  const members = useData(loadMembers);
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<Member | 'new' | null>(null);
  const [detail, setDetail] = useState<Member | null>(null);

  const s = search.toLowerCase();
  const list = (members.data ?? []).filter(
    (m) =>
      (showInactive || m.active) &&
      `${m.first_name} ${m.last_name} ${m.group_name ?? ''}`.toLowerCase().includes(s),
  );

  const remove = (m: Member) =>
    modals.openConfirmModal({
      title: `${memberName(m)} löschen?`,
      children: <Text size="sm">Mitglieder mit Käufen können nicht gelöscht werden – dann bitte deaktivieren.</Text>,
      labels: { confirm: 'Löschen', cancel: 'Abbrechen' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        if (await attempt(() => q(supabase.from('members').delete().eq('id', m.id)), 'Mitglied gelöscht.')) void members.reload();
      },
    });

  return (
    <>
      <PageHeader title="Mitglieder">
        <Button leftSection={<IconPlus size={16} />} onClick={() => setEditing('new')}>
          Neues Mitglied
        </Button>
      </PageHeader>
      <Group mb="md">
        <TextInput placeholder="Name oder Gruppe suchen…" value={search} onChange={(e) => setSearch(e.currentTarget.value)} w={260} />
        <Switch label="Inaktive anzeigen" checked={showInactive} onChange={(e) => setShowInactive(e.currentTarget.checked)} />
      </Group>
      <LoadingState loading={members.loading} error={members.error}>
        <Table.ScrollContainer minWidth={560}>
          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Gruppe</Table.Th>
                <Table.Th>Kontakt</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {list.map((m) => (
                <Table.Tr key={m.id} className="clickable-row" onClick={() => setDetail(m)} opacity={m.active ? 1 : 0.5}>
                  <Table.Td fw={500}>{memberName(m)}</Table.Td>
                  <Table.Td>{m.group_name}</Table.Td>
                  <Table.Td>{m.contact}</Table.Td>
                  <Table.Td onClick={(e) => e.stopPropagation()}>
                    <Group gap={4} justify="flex-end" wrap="nowrap">
                      <ActionIcon variant="subtle" onClick={() => setEditing(m)}>
                        <IconEdit size={16} />
                      </ActionIcon>
                      <ActionIcon variant="subtle" color="red" onClick={() => remove(m)}>
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
        {list.length === 0 && <Text c="dimmed">Keine Mitglieder gefunden.</Text>}
      </LoadingState>

      <MemberFormModal
        opened={editing !== null}
        member={editing === 'new' ? null : editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          void members.reload();
        }}
      />
      <MemberDetail member={detail} onClose={() => setDetail(null)} />
    </>
  );
}

function MemberDetail({ member, onClose }: { member: Member | null; onClose: () => void }) {
  const sales = useData(() => (member ? loadSales({ memberId: member.id }) : Promise.resolve([])), [member?.id]);
  const contracts = useData(() => (member ? loadContracts() : Promise.resolve([])), [member?.id]);
  const myContracts = (contracts.data ?? []).filter((c) => c.member_id === member?.id);

  return (
    <Drawer opened={!!member} onClose={onClose} position="right" size="lg" title={member ? memberName(member) : ''}>
      {member && (
        <Stack>
          <Text size="sm" c="dimmed">
            {[member.group_name, member.contact].filter(Boolean).join(' · ')}
          </Text>
          {member.notes && <Text size="sm">{member.notes}</Text>}

          <Title order={5}>Kluftflat</Title>
          {myContracts.length === 0 && <Text size="sm" c="dimmed">Keine Kluftflat.</Text>}
          {myContracts.map((c) => (
            <Group key={c.id} gap="xs">
              <Badge color={c.status === 'aktiv' ? 'green' : 'gray'} variant="light">
                {c.status}
              </Badge>
              <Text size="sm">
                seit {formatDate(c.started_at)} · {c.current_variant_id ? variantLabel(c.variants) : 'keine Kluft ausgegeben'} · {euro(c.fee_paid)}
              </Text>
            </Group>
          ))}

          <Title order={5}>Käufe</Title>
          <LoadingState loading={sales.loading} error={sales.error}>
            {(sales.data ?? []).length === 0 && <Text size="sm" c="dimmed">Noch keine Käufe.</Text>}
            {(sales.data ?? []).map((s) => (
              <Stack key={s.id} gap={2} style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }} pb={6} opacity={s.cancelled ? 0.5 : 1}>
                <Group justify="space-between">
                  <Group gap="xs">
                    <Text size="sm" fw={500}>
                      {formatDate(s.sale_date)}
                    </Text>
                    <SaleTypeBadge type={s.type} />
                    {s.cancelled && <Badge color="red">storniert</Badge>}
                  </Group>
                  <Text size="sm" fw={500}>
                    {euro(s.total)}
                  </Text>
                </Group>
                <Text size="xs" c="dimmed">
                  {s.sale_items.map((i) => `${i.quantity}× ${variantLabel(i.variants)}`).join(', ')}
                </Text>
              </Stack>
            ))}
          </LoadingState>
        </Stack>
      )}
    </Drawer>
  );
}
