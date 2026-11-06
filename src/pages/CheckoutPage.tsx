import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Chip,
  Divider,
  Grid,
  Group,
  Modal,
  NumberInput,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { IconGift, IconRestore, IconShoppingCart, IconTrash } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { ConditionBadge, LoadingState, MemberSelect, PageHeader, ProductThumb, StaffSelect } from '../components/common';
import { loadCategories, loadMembers, loadProducts, loadStaff, loadStock } from '../lib/api';
import { useAuth } from '../lib/auth';
import { CONDITION_LABELS, CONDITIONS, PAYMENT_OPTIONS, euro, sizeLabel, today } from '../lib/format';
import { attempt } from '../lib/notify';
import { rpc } from '../lib/supabase';
import type { Condition, Product, Variant } from '../lib/types';
import { useData } from '../lib/useData';

interface CartItem {
  key: string;
  product: Product;
  variant: Variant;
  condition: Condition;
  quantity: number;
  listPrice: number;
  unitPrice: number;
  reason: string;
}

const stockKey = (variantId: string, condition: Condition) => `${variantId}|${condition}`;

export default function CheckoutPage() {
  const { staff: me } = useAuth();
  const products = useData(loadProducts);
  const categories = useData(loadCategories);
  const stock = useData(loadStock);
  const members = useData(loadMembers);
  const staff = useData(loadStaff);

  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('alle');
  const [picking, setPicking] = useState<Product | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [staffId, setStaffId] = useState<string | null>(me?.id ?? null);
  const [payment, setPayment] = useState('bar');
  const [date, setDate] = useState(today());
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [triedSubmit, setTriedSubmit] = useState(false);

  const stockMap = useMemo(() => {
    const m = new Map<string, number>();
    (stock.data ?? []).forEach((r) => m.set(stockKey(r.variant_id, r.condition), r.quantity));
    return m;
  }, [stock.data]);

  const available = (variantId: string, condition: Condition) =>
    (stockMap.get(stockKey(variantId, condition)) ?? 0) -
    cart.filter((c) => c.variant.id === variantId && c.condition === condition).reduce((a, c) => a + c.quantity, 0);

  const visible = (products.data ?? []).filter(
    (p) =>
      p.active &&
      p.variants.some((v) => v.active) &&
      (cat === 'alle' || p.category_id === cat) &&
      p.name.toLowerCase().includes(search.toLowerCase()),
  );

  const addToCart = (product: Product, variant: Variant, condition: Condition, quantity: number) => {
    const listPrice = Number(variant.price ?? product.price);
    setCart((prev) => {
      const existing = prev.find((c) => c.variant.id === variant.id && c.condition === condition);
      if (existing) return prev.map((c) => (c === existing ? { ...c, quantity: c.quantity + quantity } : c));
      return [
        ...prev,
        {
          key: `${variant.id}-${condition}-${Date.now()}`,
          product,
          variant,
          condition,
          quantity,
          listPrice,
          unitPrice: condition === 'haertefall' ? 0 : listPrice,
          reason: condition === 'haertefall' ? 'Sozialer Härtefall' : '',
        },
      ];
    });
  };

  const update = (key: string, patch: Partial<CartItem>) => setCart((prev) => prev.map((c) => (c.key === key ? { ...c, ...patch } : c)));

  const total = cart.reduce((a, c) => a + c.quantity * c.unitPrice, 0);
  const missingReason = cart.some((c) => c.unitPrice < c.listPrice && !c.reason.trim());

  const submit = async () => {
    setTriedSubmit(true);
    if (!memberId || cart.length === 0 || missingReason) return;
    setBusy(true);
    const okay = await attempt(
      () =>
        rpc('complete_sale', {
          p_member: memberId,
          p_staff: staffId,
          p_payment: payment,
          p_note: note,
          p_date: date || null,
          p_items: cart.map((c) => ({
            variant_id: c.variant.id,
            condition: c.condition,
            quantity: c.quantity,
            unit_price: c.unitPrice,
            reason: c.reason,
          })),
        }),
      `Verkauf über ${euro(total)} gebucht.`,
    );
    setBusy(false);
    if (okay) {
      setCart([]);
      setMemberId(null);
      setNote('');
      setTriedSubmit(false);
      void stock.reload();
    }
  };

  return (
    <>
      <PageHeader title="Kasse" />
      <Grid gutter="lg">
        <Grid.Col span={{ base: 12, md: 7 }}>
          <Group mb="sm" gap="xs">
            <TextInput placeholder="Artikel suchen…" value={search} onChange={(e) => setSearch(e.currentTarget.value)} w={200} />
          </Group>
          <Chip.Group value={cat} onChange={(v) => setCat(v as string)}>
            <Group gap={6} mb="md">
              <Chip value="alle" size="xs">
                Alle
              </Chip>
              {(categories.data ?? []).map((c) => (
                <Chip key={c.id} value={c.id} size="xs">
                  {c.name}
                </Chip>
              ))}
            </Group>
          </Chip.Group>
          <LoadingState loading={products.loading || stock.loading} error={products.error ?? stock.error}>
            <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="sm">
              {visible.map((p) => {
                const qty = p.variants.reduce((a, v) => a + CONDITIONS.reduce((b, c) => b + available(v.id, c), 0), 0);
                return (
                  <Card key={p.id} withBorder padding="xs" className="product-card" onClick={() => setPicking(p)}>
                    <Stack gap={6} align="center">
                      <ProductThumb product={p} size={96} />
                      <Text fw={600} size="sm" ta="center" lineClamp={2}>
                        {p.name}
                      </Text>
                      <Group gap={4}>
                        <Text size="sm">{euro(p.price)}</Text>
                        <Badge size="xs" variant="light" color={qty > 0 ? 'gray' : 'red'}>
                          {qty} da
                        </Badge>
                      </Group>
                    </Stack>
                  </Card>
                );
              })}
            </SimpleGrid>
          </LoadingState>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 5 }}>
          <Paper withBorder p="md" pos="sticky" top={72}>
            <Group mb="sm" gap="xs">
              <IconShoppingCart size={20} />
              <Title order={4}>Warenkorb</Title>
              {cart.length > 0 && <Badge>{cart.reduce((a, c) => a + c.quantity, 0)}</Badge>}
            </Group>
            {cart.length === 0 && (
              <Text c="dimmed" size="sm" mb="md">
                Artikel links antippen, um sie hinzuzufügen.
              </Text>
            )}
            <Stack gap="sm">
              {cart.map((c) => {
                const discounted = c.unitPrice < c.listPrice;
                return (
                  <Paper key={c.key} withBorder p="xs" radius="md">
                    <Group wrap="nowrap" align="flex-start" gap="xs">
                      <ProductThumb product={c.product} size={40} />
                      <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
                        <Group justify="space-between" wrap="nowrap" gap={4}>
                          <Text size="sm" fw={600} truncate>
                            {c.product.name} {sizeLabel(c.variant.size)}
                          </Text>
                          <ActionIcon variant="subtle" color="red" size="sm" onClick={() => setCart(cart.filter((x) => x.key !== c.key))}>
                            <IconTrash size={14} />
                          </ActionIcon>
                        </Group>
                        {c.condition !== 'neu' && <ConditionBadge condition={c.condition} />}
                        <Group gap="xs" wrap="nowrap" align="flex-end">
                          <NumberInput
                            size="xs"
                            label="Menge"
                            w={70}
                            min={1}
                            max={c.quantity + available(c.variant.id, c.condition)}
                            value={c.quantity}
                            onChange={(v) => update(c.key, { quantity: Math.max(1, Number(v || 1)) })}
                          />
                          <NumberInput
                            size="xs"
                            label={`Preis (Liste ${euro(c.listPrice)})`}
                            w={130}
                            min={0}
                            decimalScale={2}
                            decimalSeparator=","
                            suffix=" €"
                            value={c.unitPrice}
                            onChange={(v) => update(c.key, { unitPrice: Math.max(0, Number(v || 0)) })}
                          />
                          <Tooltip label="Kostenlos ausgeben">
                            <ActionIcon variant="light" color="grape" onClick={() => update(c.key, { unitPrice: 0 })} mb={2}>
                              <IconGift size={16} />
                            </ActionIcon>
                          </Tooltip>
                          {discounted && (
                            <Tooltip label="Listenpreis wiederherstellen">
                              <ActionIcon variant="subtle" onClick={() => update(c.key, { unitPrice: c.listPrice, reason: '' })} mb={2}>
                                <IconRestore size={16} />
                              </ActionIcon>
                            </Tooltip>
                          )}
                        </Group>
                        {discounted && (
                          <TextInput
                            size="xs"
                            required
                            label={c.unitPrice === 0 ? 'Grund für kostenlose Ausgabe' : `Grund für Rabatt (${Math.round((1 - c.unitPrice / c.listPrice) * 100)} %)`}
                            placeholder="z. B. Geschenk zum Versprechen"
                            value={c.reason}
                            onChange={(e) => update(c.key, { reason: e.currentTarget.value })}
                            error={!c.reason.trim() ? 'Pflichtfeld' : null}
                          />
                        )}
                        <Text size="xs" ta="right" fw={500}>
                          {euro(c.quantity * c.unitPrice)}
                        </Text>
                      </Stack>
                    </Group>
                  </Paper>
                );
              })}
            </Stack>

            <Divider my="md" />
            <Group justify="space-between" mb="md">
              <Text fw={700} size="lg">
                Summe
              </Text>
              <Text fw={700} size="lg">
                {euro(total)}
              </Text>
            </Group>

            <Stack gap="sm">
              <MemberSelect
                members={members.data ?? []}
                value={memberId}
                onChange={setMemberId}
                onCreated={(m) => members.setData([...(members.data ?? []), m])}
                error={triedSubmit && !memberId ? 'Bitte Käufer auswählen' : null}
              />
              <Group grow>
                <StaffSelect staff={staff.data ?? []} value={staffId} onChange={setStaffId} />
                <Select label="Zahlung" data={PAYMENT_OPTIONS} value={payment} onChange={(v) => setPayment(v ?? 'bar')} allowDeselect={false} />
              </Group>
              <Group grow>
                <TextInput label="Datum" type="date" value={date} onChange={(e) => setDate(e.currentTarget.value)} />
                <TextInput label="Notiz" value={note} onChange={(e) => setNote(e.currentTarget.value)} />
              </Group>
              {triedSubmit && missingReason && (
                <Alert color="red" p="xs">
                  Für rabattierte oder kostenlose Artikel bitte einen Grund eintragen.
                </Alert>
              )}
              <Button size="md" onClick={submit} loading={busy} disabled={cart.length === 0}>
                Verkauf abschließen
              </Button>
            </Stack>
          </Paper>
        </Grid.Col>
      </Grid>

      <AddToCartModal
        product={picking}
        available={available}
        onClose={() => setPicking(null)}
        onAdd={(v, cond, qty) => {
          if (picking) addToCart(picking, v, cond, qty);
          setPicking(null);
        }}
      />
    </>
  );
}

function AddToCartModal({
  product,
  available,
  onClose,
  onAdd,
}: {
  product: Product | null;
  available: (variantId: string, c: Condition) => number;
  onClose: () => void;
  onAdd: (v: Variant, c: Condition, qty: number) => void;
}) {
  const [variantId, setVariantId] = useState<string | null>(null);
  const [condition, setCondition] = useState<Condition>('neu');
  const [qty, setQty] = useState(1);

  const variants = product?.variants.filter((v) => v.active) ?? [];
  const selected = variants.find((v) => v.id === variantId) ?? (variants.length === 1 ? variants[0] : undefined);
  const max = selected ? available(selected.id, condition) : 0;

  const reset = () => {
    setVariantId(null);
    setCondition('neu');
    setQty(1);
  };

  return (
    <Modal
      opened={!!product}
      onClose={() => {
        reset();
        onClose();
      }}
      title={product?.name}
    >
      {product && (
        <Stack>
          <Group>
            <ProductThumb product={product} size={120} />
            <Stack gap={2}>
              <Text fw={600}>{euro(product.price)}</Text>
              {product.description && (
                <Text size="sm" c="dimmed">
                  {product.description}
                </Text>
              )}
            </Stack>
          </Group>
          {variants.length > 1 && (
            <>
              <Text size="sm" fw={500}>
                Größe
              </Text>
              <Chip.Group value={variantId ?? ''} onChange={(v) => setVariantId(v as string)}>
                <Group gap={6}>
                  {variants.map((v) => {
                    const n = CONDITIONS.reduce((a, c) => a + available(v.id, c), 0);
                    return (
                      <Chip key={v.id} value={v.id} disabled={n <= 0} size="sm">
                        {v.size} ({n})
                      </Chip>
                    );
                  })}
                </Group>
              </Chip.Group>
            </>
          )}
          {selected && (
            <>
              <Text size="sm" fw={500}>
                Zustand
              </Text>
              <Chip.Group value={condition} onChange={(v) => setCondition(v as Condition)}>
                <Group gap={6}>
                  {CONDITIONS.map((c) => (
                    <Chip key={c} value={c} size="sm" disabled={available(selected.id, c) <= 0}>
                      {CONDITION_LABELS[c]} ({available(selected.id, c)})
                    </Chip>
                  ))}
                </Group>
              </Chip.Group>
              {condition === 'haertefall' && (
                <Text size="xs" c="dimmed">
                  Härtefall-Ware wird standardmäßig kostenlos mit Grund „Sozialer Härtefall“ in den Warenkorb gelegt.
                </Text>
              )}
              <NumberInput label="Menge" min={1} max={Math.max(1, max)} value={qty} onChange={(v) => setQty(Number(v || 1))} w={120} />
            </>
          )}
          <Button
            disabled={!selected || max < qty || qty < 1}
            onClick={() => {
              if (selected) onAdd(selected, condition, qty);
              reset();
            }}
          >
            {selected && max < qty ? 'Nicht genug Bestand' : 'In den Warenkorb'}
          </Button>
        </Stack>
      )}
    </Modal>
  );
}
