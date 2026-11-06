import { Badge, Button, Card, Group, SimpleGrid, Stack, Table, Text, Title } from '@mantine/core';
import { IconShirt, IconShoppingCart } from '@tabler/icons-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { LoadingState, PageHeader, SaleTypeBadge } from '../components/common';
import { loadContracts, loadSales, loadStock } from '../lib/api';
import { useAuth } from '../lib/auth';
import { euro, firstOfMonth, formatDate, memberName, sizeLabel, today } from '../lib/format';
import { useData } from '../lib/useData';

export default function DashboardPage() {
  const { staff } = useAuth();
  const sales = useData(() => loadSales({ from: firstOfMonth() }));
  const recent = useData(() => loadSales({ limit: 10 }));
  const stock = useData(loadStock);
  const contracts = useData(loadContracts);

  const active = (sales.data ?? []).filter((s) => !s.cancelled);
  const todaySum = active.filter((s) => s.sale_date === today()).reduce((a, s) => a + Number(s.total), 0);
  const monthSum = active.reduce((a, s) => a + Number(s.total), 0);
  const activeFlats = (contracts.data ?? []).filter((c) => c.status === 'aktiv');
  const pendingSwap = activeFlats.filter((c) => !c.current_variant_id).length;
  const low = useMemo(
    () => (stock.data ?? []).filter((r) => r.active && r.condition === 'neu' && r.quantity < r.min_stock),
    [stock.data],
  );

  return (
    <>
      <PageHeader title={`Hallo ${staff?.name ?? ''}!`}>
        <Button component={Link} to="/kasse" leftSection={<IconShoppingCart size={16} />}>
          Zur Kasse
        </Button>
        <Button component={Link} to="/kluftflat" variant="light" leftSection={<IconShirt size={16} />}>
          Kluftflat
        </Button>
      </PageHeader>

      <SimpleGrid cols={{ base: 2, md: 4 }} mb="lg">
        <Stat label="Einnahmen heute" value={euro(todaySum)} />
        <Stat label="Einnahmen diesen Monat" value={euro(monthSum)} />
        <Stat label="Aktive Kluftflats" value={String(activeFlats.length)} hint={pendingSwap ? `${pendingSwap} Tausch ausstehend` : undefined} />
        <Stat label="Unter Mindestbestand" value={String(low.length)} color={low.length ? 'red' : undefined} />
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, lg: 2 }}>
        <Card withBorder>
          <Group justify="space-between" mb="sm">
            <Title order={4}>Letzte Vorgänge</Title>
            <Button component={Link} to="/verkaeufe" variant="subtle" size="xs">
              Alle
            </Button>
          </Group>
          <LoadingState loading={recent.loading} error={recent.error}>
            <Table>
              <Table.Tbody>
                {(recent.data ?? []).map((s) => (
                  <Table.Tr key={s.id} className={s.cancelled ? 'cancelled-row' : ''}>
                    <Table.Td>{formatDate(s.sale_date)}</Table.Td>
                    <Table.Td>
                      <SaleTypeBadge type={s.type} />
                    </Table.Td>
                    <Table.Td>{memberName(s.members)}</Table.Td>
                    <Table.Td>
                      <Text size="xs" c="dimmed">
                        {s.staff?.name}
                      </Text>
                    </Table.Td>
                    <Table.Td ta="right">{euro(s.total)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
            {(recent.data ?? []).length === 0 && <Text c="dimmed">Noch keine Verkäufe.</Text>}
          </LoadingState>
        </Card>
        <Card withBorder>
          <Group justify="space-between" mb="sm">
            <Title order={4}>Nachbestellen</Title>
            <Button component={Link} to="/bestand" variant="subtle" size="xs">
              Bestand
            </Button>
          </Group>
          <LoadingState loading={stock.loading} error={stock.error}>
            <Stack gap={4}>
              {low.map((r) => (
                <Group key={r.variant_id} justify="space-between">
                  <Text size="sm">
                    {r.product_name} {sizeLabel(r.size)}
                  </Text>
                  <Badge color="red" variant="light">
                    {r.quantity} / {r.min_stock}
                  </Badge>
                </Group>
              ))}
              {low.length === 0 && (
                <Text c="dimmed" size="sm">
                  Alles ausreichend vorrätig (Mindestbestände pflegst du bei den Produkten).
                </Text>
              )}
            </Stack>
          </LoadingState>
          {pendingSwap > 0 && (
            <Text size="sm" mt="md">
              {pendingSwap} Flat-Tausch ausstehend:{' '}
              {activeFlats
                .filter((c) => !c.current_variant_id)
                .map((c) => memberName(c.members))
                .join(', ')}
            </Text>
          )}
        </Card>
      </SimpleGrid>
    </>
  );
}

function Stat({ label, value, hint, color }: { label: string; value: string; hint?: string; color?: string }) {
  return (
    <Card withBorder padding="md">
      <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
        {label}
      </Text>
      <Text size="xl" fw={700} c={color}>
        {value}
      </Text>
      {hint && (
        <Text size="xs" c="orange">
          {hint}
        </Text>
      )}
    </Card>
  );
}
