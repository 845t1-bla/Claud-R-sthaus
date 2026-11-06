import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Chip,
  Group,
  Modal,
  NumberInput,
  Paper,
  Radio,
  Select,
  Stack,
  Table,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { IconArrowBackUp, IconInfoCircle, IconShirt, IconList } from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';
import { LoadingState, MemberSelect, PageHeader, ProductThumb, StaffSelect } from '../components/common';
import {
  loadCategories,
  loadContracts,
  loadFlatPatchDefaults,
  loadFlatPrice,
  loadMembers,
  loadProducts,
  loadStaff,
  loadStock,
} from '../lib/api';
import { useAuth } from '../lib/auth';
import {
  ASSESSMENT_LABELS,
  CONDITION_LABELS,
  PAYMENT_OPTIONS,
  euro,
  formatDate,
  memberName,
  sizeLabel,
  today,
  variantLabel,
} from '../lib/format';
import { attempt } from '../lib/notify';
import { rpc } from '../lib/supabase';
import type { Assessment, Condition, FlatContract, Product } from '../lib/types';
import { useData } from '../lib/useData';

const key = (variantId: string, c: Condition) => `${variantId}|${c}`;

export default function FlatPage() {
  const contracts = useData(loadContracts);
  const [tab, setTab] = useState<string | null>('ausgabe');
  const [presetMember, setPresetMember] = useState<string | null>(null);
  const [exchangeFor, setExchangeFor] = useState<FlatContract | null>(null);
  const [version, setVersion] = useState(0); // erzwingt Neuladen der Formulare

  const refresh = () => {
    void contracts.reload();
    setVersion((v) => v + 1);
  };

  const pending = (contracts.data ?? []).filter((c) => c.status === 'aktiv' && !c.current_variant_id);

  return (
    <>
      <PageHeader title="Kluftflat" />
      <Tabs value={tab} onChange={setTab} keepMounted={false}>
        <Tabs.List mb="md">
          <Tabs.Tab value="ausgabe" leftSection={<IconShirt size={16} />}>
            Neue Flat ausgeben
          </Tabs.Tab>
          <Tabs.Tab value="rueckgabe" leftSection={<IconArrowBackUp size={16} />}>
            Rückgabe / Tausch {pending.length > 0 && <Badge size="xs" ml={4}>{pending.length}</Badge>}
          </Tabs.Tab>
          <Tabs.Tab value="vertraege" leftSection={<IconList size={16} />}>
            Alle Flats
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="ausgabe">
          <Paper withBorder p="md" maw={820}>
            <FlatIssueForm key={`new-${version}-${presetMember}`} contract={null} presetMember={presetMember} onDone={refresh} />
          </Paper>
        </Tabs.Panel>

        <Tabs.Panel value="rueckgabe">
          <Stack maw={820}>
            {pending.length > 0 && (
              <Paper withBorder p="md">
                <Title order={5} mb="xs">
                  Tausch ausstehend
                </Title>
                <Text size="sm" c="dimmed" mb="sm">
                  Kluft wurde sauber zurückgegeben – neue Kluft im Rahmen der Flat noch nicht ausgegeben.
                </Text>
                <Stack gap="xs">
                  {pending.map((c) => (
                    <Group key={c.id} justify="space-between">
                      <Text>{memberName(c.members)}</Text>
                      <Group gap="xs">
                        <Button size="xs" onClick={() => setExchangeFor(c)}>
                          Neue Kluft ausgeben
                        </Button>
                        <Button
                          size="xs"
                          variant="default"
                          onClick={() =>
                            modals.openConfirmModal({
                              title: 'Flat beenden?',
                              children: <Text size="sm">Das Mitglied erhält keine neue Kluft mehr (z. B. Austritt).</Text>,
                              labels: { confirm: 'Beenden', cancel: 'Abbrechen' },
                              onConfirm: async () => {
                                if (await attempt(() => rpc('end_flat', { p_contract: c.id, p_note: 'Flat beendet ohne Tausch' }), 'Flat beendet.')) refresh();
                              },
                            })
                          }
                        >
                          Flat beenden
                        </Button>
                      </Group>
                    </Group>
                  ))}
                </Stack>
              </Paper>
            )}
            <Paper withBorder p="md">
              <ReturnForm
                key={`ret-${version}`}
                contracts={(contracts.data ?? []).filter((c) => c.status === 'aktiv' && c.current_variant_id)}
                onReturned={(contract, assessment, ended) => {
                  refresh();
                  if (assessment === 'sauber' && !ended) setExchangeFor(contract);
                  if (assessment !== 'sauber') {
                    modals.open({
                      title: 'Neue Kluft nur gegen Bezahlung',
                      children: (
                        <Stack>
                          <Text size="sm">
                            Die Kluft war beschädigt – die Flat ist damit beendet. Eine neue Kluft gibt es nur mit einer neuen Kluftflat
                            (erneute Zahlung).
                          </Text>
                          <Group justify="flex-end">
                            <Button variant="default" onClick={() => modals.closeAll()}>
                              Später
                            </Button>
                            <Button
                              onClick={() => {
                                modals.closeAll();
                                setPresetMember(contract.member_id);
                                setTab('ausgabe');
                              }}
                            >
                              Neue Flat ausgeben
                            </Button>
                          </Group>
                        </Stack>
                      ),
                    });
                  }
                }}
              />
            </Paper>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="vertraege">
          <ContractsTable contracts={contracts.data ?? []} loading={contracts.loading} error={contracts.error} />
        </Tabs.Panel>
      </Tabs>

      <Modal opened={!!exchangeFor} onClose={() => setExchangeFor(null)} title={`Tausch für ${memberName(exchangeFor?.members)}`} size="xl">
        {exchangeFor && (
          <FlatIssueForm
            contract={exchangeFor}
            presetMember={exchangeFor.member_id}
            onDone={() => {
              setExchangeFor(null);
              refresh();
            }}
          />
        )}
      </Modal>
    </>
  );
}

/** Ausgabe einer Kluftflat (neu) oder Tausch (contract gesetzt) */
function FlatIssueForm({
  contract,
  presetMember,
  onDone,
}: {
  contract: FlatContract | null;
  presetMember: string | null;
  onDone: () => void;
}) {
  const { staff: me } = useAuth();
  const products = useData(loadProducts);
  const categories = useData(loadCategories);
  const stock = useData(loadStock);
  const patches = useData(loadFlatPatchDefaults);
  const members = useData(loadMembers);
  const staff = useData(loadStaff);
  const flatPrice = useData(loadFlatPrice);

  const [memberId, setMemberId] = useState<string | null>(presetMember);
  const [productId, setProductId] = useState<string | null>(null);
  const [variantId, setVariantId] = useState<string | null>(null);
  const [condition, setCondition] = useState<Condition | null>(null);
  const [selectedPatches, setSelectedPatches] = useState<Record<string, number>>({});
  const [fee, setFee] = useState<number | ''>('');
  const [feeReason, setFeeReason] = useState('');
  const [staffId, setStaffId] = useState<string | null>(me?.id ?? null);
  const [payment, setPayment] = useState('bar');
  const [date, setDate] = useState(today());
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const isExchange = !!contract;
  const kluftCats = new Set((categories.data ?? []).filter((c) => c.is_kluft).map((c) => c.id));
  const kluftProducts = (products.data ?? []).filter((p) => p.active && kluftCats.has(p.category_id));
  const allVariants = useMemo(() => {
    const m = new Map<string, { product: Product; size: string }>();
    (products.data ?? []).forEach((p) => p.variants.forEach((v) => m.set(v.id, { product: p, size: v.size })));
    return m;
  }, [products.data]);

  const stockMap = useMemo(() => {
    const m = new Map<string, number>();
    (stock.data ?? []).forEach((r) => m.set(key(r.variant_id, r.condition), r.quantity));
    return m;
  }, [stock.data]);
  const qty = (v: string, c: Condition) => stockMap.get(key(v, c)) ?? 0;

  useEffect(() => {
    if (fee === '' && flatPrice.data != null) setFee(flatPrice.data);
  }, [flatPrice.data, fee]);

  useEffect(() => {
    if (patches.data) setSelectedPatches(Object.fromEntries(patches.data.map((p) => [p.variant_id, p.quantity])));
  }, [patches.data]);

  useEffect(() => {
    if (!productId && kluftProducts.length === 1) setProductId(kluftProducts[0].id);
  }, [kluftProducts, productId]);

  const product = kluftProducts.find((p) => p.id === productId);

  const chooseVariant = (vId: string) => {
    setVariantId(vId);
    // gebrauchte Flat-Kluft bevorzugen
    setCondition(qty(vId, 'gebraucht_flat') > 0 ? 'gebraucht_flat' : qty(vId, 'neu') > 0 ? 'neu' : null);
  };

  const flatP = flatPrice.data ?? 40;
  const feeReduced = !isExchange && fee !== '' && Number(fee) < flatP;
  const patchShortage = Object.entries(selectedPatches).filter(([v, n]) => n > 0 && qty(v, 'neu') < n);
  const canSubmit =
    !!memberId && !!variantId && !!condition && (!feeReduced || feeReason.trim()) && patchShortage.length === 0 && fee !== '';

  const submit = async () => {
    setBusy(true);
    const okay = await attempt(
      () =>
        rpc('issue_flat', {
          p_member: memberId,
          p_staff: staffId,
          p_kluft_variant: variantId,
          p_kluft_condition: condition,
          p_patches: Object.entries(selectedPatches)
            .filter(([, n]) => n > 0)
            .map(([variant_id, quantity]) => ({ variant_id, quantity })),
          p_fee: isExchange ? 0 : fee,
          p_fee_reason: feeReason,
          p_payment: payment,
          p_note: note,
          p_contract: contract?.id ?? null,
          p_date: date || null,
        }),
      isExchange ? 'Tausch gebucht.' : 'Kluftflat ausgegeben.',
    );
    setBusy(false);
    if (okay) onDone();
  };

  const loading = products.loading || stock.loading || patches.loading || categories.loading;

  return (
    <LoadingState loading={loading} error={products.error ?? stock.error ?? patches.error}>
      <Stack>
        {!isExchange && (
          <MemberSelect
            label="Mitglied"
            members={members.data ?? []}
            value={memberId}
            onChange={setMemberId}
            onCreated={(m) => members.setData([...(members.data ?? []), m])}
          />
        )}
        {isExchange && (
          <Alert color="teal" icon={<IconInfoCircle />}>
            Tausch im Rahmen der Kluftflat – kostenlos.
          </Alert>
        )}

        <Title order={5}>Kluft</Title>
        {kluftProducts.length > 1 && (
          <Select
            label="Modell"
            data={kluftProducts.map((p) => ({ value: p.id, label: p.name }))}
            value={productId}
            onChange={(v) => {
              setProductId(v);
              setVariantId(null);
              setCondition(null);
            }}
          />
        )}
        {kluftProducts.length === 0 && (
          <Text c="red" size="sm">
            Keine Kluft-Produkte vorhanden. Bitte unter Einstellungen → Kategorien eine Kategorie als „Kluft“ markieren.
          </Text>
        )}
        {product && (
          <Group align="flex-start" wrap="nowrap">
            <ProductThumb product={product} size={72} />
            <Stack gap="xs" style={{ flex: 1 }}>
              <Text size="sm" fw={500}>
                Größe (gebraucht / neu)
              </Text>
              <Chip.Group value={variantId ?? ''} onChange={(v) => chooseVariant(v as string)}>
                <Group gap={6}>
                  {product.variants
                    .filter((v) => v.active)
                    .map((v) => {
                      const g = qty(v.id, 'gebraucht_flat');
                      const n = qty(v.id, 'neu');
                      return (
                        <Chip key={v.id} value={v.id} size="sm" disabled={g + n === 0}>
                          {v.size} ({g}/{n})
                        </Chip>
                      );
                    })}
                </Group>
              </Chip.Group>
              {variantId && (
                <Radio.Group value={condition ?? ''} onChange={(v) => setCondition(v as Condition)} label="Zustand">
                  <Group mt={4}>
                    {(['gebraucht_flat', 'neu'] as Condition[]).map((c) => (
                      <Radio key={c} value={c} label={`${CONDITION_LABELS[c]} (${qty(variantId, c)})`} disabled={qty(variantId, c) === 0} />
                    ))}
                  </Group>
                </Radio.Group>
              )}
            </Stack>
          </Group>
        )}

        <Title order={5} mt="sm">
          Aufnäher
        </Title>
        <Text size="xs" c="dimmed" mt={-8}>
          Abgewählte Aufnäher werden nicht ausgebucht (z. B. weil sie bereits auf der Kluft aufgenäht sind).
        </Text>
        {(patches.data ?? []).length === 0 && (
          <Text size="sm" c="dimmed">
            Keine Standard-Aufnäher festgelegt (Einstellungen → Flat-Aufnäher).
          </Text>
        )}
        <Stack gap={6}>
          {(patches.data ?? []).map((p) => {
            const info = allVariants.get(p.variant_id);
            const n = selectedPatches[p.variant_id] ?? 0;
            const checked = n > 0;
            const avail = qty(p.variant_id, 'neu');
            return (
              <Paper key={p.id} withBorder p={6} radius="md" opacity={checked ? 1 : 0.6}>
                <Group wrap="nowrap" gap="sm">
                  <Checkbox
                    checked={checked}
                    onChange={(e) => setSelectedPatches({ ...selectedPatches, [p.variant_id]: e.currentTarget.checked ? p.quantity : 0 })}
                  />
                  <ProductThumb product={info?.product} size={36} />
                  <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
                    <Text size="sm" fw={500} truncate>
                      {info?.product.name} {sizeLabel(info?.size ?? '')}
                    </Text>
                    <Text size="xs" c={checked ? (avail < n ? 'red' : 'dimmed') : 'dimmed'}>
                      {checked ? `Bestand: ${avail}` : 'bereits aufgenäht – wird nicht ausgebucht'}
                    </Text>
                  </Stack>
                  {checked && (
                    <NumberInput
                      size="xs"
                      w={64}
                      min={1}
                      value={n}
                      onChange={(v) => setSelectedPatches({ ...selectedPatches, [p.variant_id]: Math.max(1, Number(v || 1)) })}
                    />
                  )}
                </Group>
              </Paper>
            );
          })}
        </Stack>
        {patchShortage.length > 0 && (
          <Alert color="red" p="xs">
            Nicht genug Bestand bei: {patchShortage.map(([v]) => allVariants.get(v)?.product.name).join(', ')}. Bitte abwählen oder Wareneingang
            buchen.
          </Alert>
        )}

        {!isExchange && (
          <Group grow align="flex-start" mt="sm">
            <NumberInput
              label={`Betrag (regulär ${euro(flatP)})`}
              min={0}
              decimalScale={2}
              decimalSeparator=","
              suffix=" €"
              value={fee}
              onChange={(v) => setFee(v === '' ? '' : Number(v))}
            />
            {feeReduced && (
              <TextInput
                label="Grund für Ermäßigung"
                required
                value={feeReason}
                onChange={(e) => setFeeReason(e.currentTarget.value)}
                error={!feeReason.trim() ? 'Pflichtfeld' : null}
              />
            )}
          </Group>
        )}
        <Group grow>
          <StaffSelect staff={staff.data ?? []} value={staffId} onChange={setStaffId} />
          {!isExchange && <Select label="Zahlung" data={PAYMENT_OPTIONS} value={payment} onChange={(v) => setPayment(v ?? 'bar')} allowDeselect={false} />}
          <TextInput label="Datum" type="date" value={date} onChange={(e) => setDate(e.currentTarget.value)} />
        </Group>
        <Textarea label="Notiz" value={note} onChange={(e) => setNote(e.currentTarget.value)} autosize />
        <Button size="md" onClick={submit} loading={busy} disabled={!canSubmit}>
          {isExchange ? 'Tausch buchen' : `Kluftflat ausgeben (${euro(fee || 0)})`}
        </Button>
      </Stack>
    </LoadingState>
  );
}

function ReturnForm({
  contracts,
  onReturned,
}: {
  contracts: FlatContract[];
  onReturned: (c: FlatContract, a: Assessment, ended: boolean) => void;
}) {
  const { staff: me } = useAuth();
  const staff = useData(loadStaff);
  const [contractId, setContractId] = useState<string | null>(null);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [endFlat, setEndFlat] = useState(false);
  const [note, setNote] = useState('');
  const [staffId, setStaffId] = useState<string | null>(me?.id ?? null);
  const [date, setDate] = useState(today());
  const [busy, setBusy] = useState(false);
  const contract = contracts.find((c) => c.id === contractId);

  const submit = async () => {
    if (!contract || !assessment) return;
    setBusy(true);
    const okay = await attempt(
      () =>
        rpc('return_flat', {
          p_contract: contract.id,
          p_staff: staffId,
          p_assessment: assessment,
          p_note: note,
          p_end: endFlat,
          p_date: date || null,
        }),
      'Rückgabe gebucht.',
    );
    setBusy(false);
    if (okay) onReturned(contract, assessment, endFlat);
  };

  const effects: Record<Assessment, string> = {
    sauber: 'Kluft kommt in den Bestand „Gebraucht (Flat)“. Das Mitglied bekommt kostenlos eine neue passende Kluft.',
    beschaedigt_ok: 'Kluft kommt in den Bestand „Härtefall“. Die Flat endet – eine neue Kluft muss wieder bezahlt werden.',
    unbrauchbar: 'Kluft wird entsorgt. Die Flat endet – eine neue Kluft muss wieder bezahlt werden.',
  };

  return (
    <Stack>
      <Title order={5}>Kluft zurücknehmen</Title>
      <Select
        label="Mitglied mit aktiver Flat"
        placeholder="Name suchen…"
        searchable
        data={contracts.map((c) => ({ value: c.id, label: `${memberName(c.members)} – ${variantLabel(c.variants)}` }))}
        value={contractId}
        onChange={setContractId}
        nothingFoundMessage="Keine aktive Flat gefunden"
      />
      {contract && (
        <>
          <Text size="sm">
            Ausgegeben: <b>{variantLabel(contract.variants)}</b> · Flat seit {formatDate(contract.started_at)}
          </Text>
          <Radio.Group label="Zustand der zurückgegebenen Kluft" value={assessment ?? ''} onChange={(v) => setAssessment(v as Assessment)} required>
            <Stack mt="xs" gap="xs">
              {(Object.keys(ASSESSMENT_LABELS) as Assessment[]).map((a) => (
                <Radio key={a} value={a} label={ASSESSMENT_LABELS[a]} description={effects[a]} />
              ))}
            </Stack>
          </Radio.Group>
          {assessment === 'sauber' && (
            <Checkbox
              label="Flat beenden – keine neue Kluft ausgeben (z. B. Austritt)"
              checked={endFlat}
              onChange={(e) => setEndFlat(e.currentTarget.checked)}
            />
          )}
          <Group grow>
            <StaffSelect staff={staff.data ?? []} value={staffId} onChange={setStaffId} />
            <TextInput label="Datum" type="date" value={date} onChange={(e) => setDate(e.currentTarget.value)} />
          </Group>
          <Textarea label="Notiz" placeholder="z. B. Art der Beschädigung" value={note} onChange={(e) => setNote(e.currentTarget.value)} autosize />
          <Button onClick={submit} loading={busy} disabled={!assessment}>
            Rückgabe buchen
          </Button>
        </>
      )}
    </Stack>
  );
}

function ContractsTable({ contracts, loading, error }: { contracts: FlatContract[]; loading: boolean; error: string | null }) {
  const [filter, setFilter] = useState<string>('aktiv');
  const [search, setSearch] = useState('');
  const list = contracts.filter(
    (c) => (filter === 'alle' || c.status === filter) && memberName(c.members).toLowerCase().includes(search.toLowerCase()),
  );
  const color = { aktiv: 'green', beendet: 'gray', storniert: 'red' } as const;
  return (
    <LoadingState loading={loading} error={error}>
      <Group mb="md">
        <TextInput placeholder="Name suchen…" value={search} onChange={(e) => setSearch(e.currentTarget.value)} />
        <Select
          w={160}
          value={filter}
          onChange={(v) => setFilter(v ?? 'aktiv')}
          allowDeselect={false}
          data={[
            { value: 'aktiv', label: 'Aktiv' },
            { value: 'beendet', label: 'Beendet' },
            { value: 'storniert', label: 'Storniert' },
            { value: 'alle', label: 'Alle' },
          ]}
        />
      </Group>
      <Table.ScrollContainer minWidth={700}>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Mitglied</Table.Th>
              <Table.Th>Seit</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Aktuelle Kluft</Table.Th>
              <Table.Th>Bezahlt</Table.Th>
              <Table.Th>Rückgaben</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {list.map((c) => (
              <Table.Tr key={c.id}>
                <Table.Td fw={500}>{memberName(c.members)}</Table.Td>
                <Table.Td>{formatDate(c.started_at)}</Table.Td>
                <Table.Td>
                  <Badge variant="light" color={color[c.status]}>
                    {c.status}
                  </Badge>
                </Table.Td>
                <Table.Td>{c.current_variant_id ? variantLabel(c.variants) : c.status === 'aktiv' ? <Badge color="yellow">Tausch ausstehend</Badge> : '–'}</Table.Td>
                <Table.Td>{euro(c.fee_paid)}</Table.Td>
                <Table.Td>
                  {(c.flat_returns ?? []).map((r) => (
                    <Text key={r.id} size="xs">
                      {formatDate(r.return_date)}: {variantLabel(r.variants)} – {ASSESSMENT_LABELS[r.assessment]}
                    </Text>
                  ))}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
      {list.length === 0 && <Text c="dimmed">Keine Einträge.</Text>}
    </LoadingState>
  );
}
