import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Drawer,
  FileButton,
  Group,
  Image,
  Menu,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Text,
  Textarea,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import {
  IconCamera,
  IconDots,
  IconPlus,
  IconStar,
  IconStarFilled,
  IconTrash,
} from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';
import { LoadingState, PageHeader, ProductThumb } from '../components/common';
import { loadCategories, loadProducts, loadStock } from '../lib/api';
import { euro } from '../lib/format';
import { resizeImage } from '../lib/image';
import { attempt, fail } from '../lib/notify';
import { IMAGE_BUCKET, imageUrl, q, supabase } from '../lib/supabase';
import type { Category, Product, ProductImage, StockRow } from '../lib/types';
import { useData } from '../lib/useData';

const SIZE_PRESETS: Record<string, string[]> = {
  'Kinder + Erwachsene': ['116', '128', '140', '152', '164', 'XS', 'S', 'M', 'L', 'XL', 'XXL'],
  'Erwachsene (XS–XXL)': ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
  Einheitsgröße: ['Einheitsgröße'],
};

export default function ProductsPage() {
  const products = useData(loadProducts);
  const categories = useData(loadCategories);
  const stock = useData(loadStock);
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState<string>('alle');
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<Product | 'new' | null>(null);

  const stockByProduct = useMemo(() => {
    const m = new Map<string, number>();
    (stock.data ?? []).forEach((r) => m.set(r.product_id, (m.get(r.product_id) ?? 0) + r.quantity));
    return m;
  }, [stock.data]);

  const list = (products.data ?? []).filter(
    (p) =>
      (showInactive || p.active) &&
      (cat === 'alle' || p.category_id === cat) &&
      p.name.toLowerCase().includes(search.toLowerCase()),
  );

  const reloadAll = () => {
    void products.reload();
    void stock.reload();
  };

  return (
    <>
      <PageHeader title="Produkte">
        <Button leftSection={<IconPlus size={16} />} onClick={() => setEditing('new')}>
          Neues Produkt
        </Button>
      </PageHeader>
      <Group mb="md" gap="sm" wrap="wrap">
        <TextInput placeholder="Suchen…" value={search} onChange={(e) => setSearch(e.currentTarget.value)} w={220} />
        <Select
          w={200}
          value={cat}
          onChange={(v) => setCat(v ?? 'alle')}
          data={[{ value: 'alle', label: 'Alle Kategorien' }, ...(categories.data ?? []).map((c) => ({ value: c.id, label: c.name }))]}
          allowDeselect={false}
        />
        <Switch label="Inaktive anzeigen" checked={showInactive} onChange={(e) => setShowInactive(e.currentTarget.checked)} />
      </Group>
      <LoadingState loading={products.loading} error={products.error}>
        <SimpleGrid cols={{ base: 1, xs: 2, md: 3, lg: 4 }}>
          {list.map((p) => (
            <Card key={p.id} withBorder padding="sm" className="product-card" onClick={() => setEditing(p)} opacity={p.active ? 1 : 0.5}>
              <Group wrap="nowrap" align="flex-start">
                <ProductThumb product={p} size={72} />
                <Stack gap={2} style={{ minWidth: 0 }}>
                  <Text fw={600} truncate>
                    {p.name}
                  </Text>
                  <Text size="sm" c="dimmed">
                    {p.categories?.name} · {euro(p.price)}
                  </Text>
                  <Group gap={4}>
                    <Badge variant="light" size="sm">
                      {p.variants.filter((v) => v.active).length} Größe(n)
                    </Badge>
                    <Badge variant="light" size="sm" color="gray">
                      Bestand {stockByProduct.get(p.id) ?? 0}
                    </Badge>
                    {!p.active && (
                      <Badge size="sm" color="red" variant="light">
                        inaktiv
                      </Badge>
                    )}
                  </Group>
                </Stack>
              </Group>
            </Card>
          ))}
        </SimpleGrid>
        {list.length === 0 && <Text c="dimmed">Keine Produkte gefunden.</Text>}
      </LoadingState>

      <ProductEditor
        product={editing === 'new' ? null : editing}
        opened={editing !== null}
        categories={categories.data ?? []}
        stock={stock.data ?? []}
        onClose={() => setEditing(null)}
        onChanged={(p) => {
          reloadAll();
          if (p) setEditing(p);
        }}
      />
    </>
  );
}

interface VariantDraft {
  id?: string;
  size: string;
  price: number | '';
  min_stock: number;
  active: boolean;
}

function ProductEditor({
  product,
  opened,
  categories,
  stock,
  onClose,
  onChanged,
}: {
  product: Product | null;
  opened: boolean;
  categories: Category[];
  stock: StockRow[];
  onClose: () => void;
  onChanged: (p?: Product) => void;
}) {
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [price, setPrice] = useState<number | ''>(0);
  const [description, setDescription] = useState('');
  const [active, setActive] = useState(true);
  const [variants, setVariants] = useState<VariantDraft[]>([]);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!opened) return;
    setName(product?.name ?? '');
    setCategoryId(product?.category_id ?? categories[0]?.id ?? null);
    setPrice(product?.price ?? 0);
    setDescription(product?.description ?? '');
    setActive(product?.active ?? true);
    setVariants(
      product?.variants.map((v) => ({ id: v.id, size: v.size, price: v.price ?? '', min_stock: v.min_stock, active: v.active })) ?? [
        { size: 'Einheitsgröße', price: '', min_stock: 0, active: true },
      ],
    );
    setImages(product?.product_images ?? []);
  }, [opened, product, categories]);

  const qtyFor = (variantId?: string) =>
    variantId ? stock.filter((s) => s.variant_id === variantId).reduce((a, s) => a + s.quantity, 0) : 0;

  const save = async () => {
    const sizes = variants.map((v) => v.size.trim());
    if (sizes.some((s) => !s)) return fail(new Error('Jede Größe braucht eine Bezeichnung.'));
    if (new Set(sizes).size !== sizes.length) return fail(new Error('Jede Größe darf nur einmal vorkommen.'));
    setBusy(true);
    let saved: Product | undefined;
    const okay = await attempt(async () => {
      const payload = {
        name: name.trim(),
        category_id: categoryId,
        price: Number(price || 0),
        description: description.trim() || null,
        active,
      };
      const row = product
        ? await q<{ id: string }>(supabase.from('products').update(payload).eq('id', product.id).select('id').single())
        : await q<{ id: string }>(supabase.from('products').insert(payload).select('id').single());

      for (const [i, v] of variants.entries()) {
        const vp = {
          product_id: row.id,
          size: v.size.trim(),
          price: v.price === '' ? null : Number(v.price),
          min_stock: Number(v.min_stock || 0),
          active: v.active,
          sort: i + 1,
        };
        if (v.id) await q(supabase.from('variants').update(vp).eq('id', v.id));
        else await q(supabase.from('variants').insert(vp));
      }
      const all = await loadProducts();
      saved = all.find((p) => p.id === row.id);
    }, 'Produkt gespeichert.');
    setBusy(false);
    if (okay) onChanged(saved);
  };

  const removeVariant = (idx: number) => {
    const v = variants[idx];
    if (!v.id) {
      setVariants(variants.filter((_, i) => i !== idx));
      return;
    }
    modals.openConfirmModal({
      title: `Größe „${v.size}“ löschen?`,
      children: <Text size="sm">Bereits verkaufte Größen können nicht gelöscht werden – dann bitte deaktivieren.</Text>,
      labels: { confirm: 'Löschen', cancel: 'Abbrechen' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        const okay = await attempt(() => q(supabase.from('variants').delete().eq('id', v.id!)), 'Größe gelöscht.');
        if (okay) {
          setVariants(variants.filter((_, i) => i !== idx));
          onChanged();
        }
      },
    });
  };

  const addPreset = (preset: string) => {
    const existing = new Set(variants.map((v) => v.size));
    const add = SIZE_PRESETS[preset].filter((s) => !existing.has(s)).map((s) => ({ size: s, price: '' as const, min_stock: 0, active: true }));
    // Platzhalter "Einheitsgröße" ohne ID entfernen, wenn echte Größen kommen
    const base = preset !== 'Einheitsgröße' ? variants.filter((v) => v.id || v.size !== 'Einheitsgröße') : variants;
    setVariants([...base, ...add]);
  };

  const upload = async (files: File[]) => {
    if (!product || files.length === 0) return;
    setUploading(true);
    await attempt(async () => {
      let next = [...images];
      for (const file of files) {
        const blob = await resizeImage(file);
        const path = `${product.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
        const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, blob, { contentType: 'image/jpeg' });
        if (error) throw new Error(error.message);
        const img = await q<ProductImage>(
          supabase
            .from('product_images')
            .insert({ product_id: product.id, path, sort: next.length, is_main: next.length === 0 })
            .select()
            .single(),
        );
        next = [...next, img];
      }
      setImages(next);
    }, files.length > 1 ? 'Bilder hochgeladen.' : 'Bild hochgeladen.');
    setUploading(false);
    onChanged();
  };

  const setMain = async (img: ProductImage) => {
    if (!product) return;
    await attempt(async () => {
      await q(supabase.from('product_images').update({ is_main: false }).eq('product_id', product.id));
      await q(supabase.from('product_images').update({ is_main: true }).eq('id', img.id));
      setImages(images.map((i) => ({ ...i, is_main: i.id === img.id })));
    });
    onChanged();
  };

  const deleteImage = (img: ProductImage) =>
    modals.openConfirmModal({
      title: 'Bild löschen?',
      labels: { confirm: 'Löschen', cancel: 'Abbrechen' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        await attempt(async () => {
          await supabase.storage.from(IMAGE_BUCKET).remove([img.path]);
          await q(supabase.from('product_images').delete().eq('id', img.id));
          const rest = images.filter((i) => i.id !== img.id);
          if (img.is_main && rest.length > 0) {
            await q(supabase.from('product_images').update({ is_main: true }).eq('id', rest[0].id));
            rest[0] = { ...rest[0], is_main: true };
          }
          setImages(rest);
        }, 'Bild gelöscht.');
        onChanged();
      },
    });

  const deleteProduct = () =>
    product &&
    modals.openConfirmModal({
      title: `„${product.name}“ löschen?`,
      children: <Text size="sm">Produkte mit Verkäufen oder Bestandsbuchungen können nicht gelöscht werden – dann bitte deaktivieren.</Text>,
      labels: { confirm: 'Löschen', cancel: 'Abbrechen' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        const okay = await attempt(async () => {
          await q(supabase.from('products').delete().eq('id', product.id));
          if (images.length) await supabase.storage.from(IMAGE_BUCKET).remove(images.map((i) => i.path));
        }, 'Produkt gelöscht.');
        if (okay) {
          onChanged();
          onClose();
        }
      },
    });

  return (
    <Drawer opened={opened} onClose={onClose} position="right" size="lg" title={product ? 'Produkt bearbeiten' : 'Neues Produkt'}>
      <Stack>
        <TextInput label="Name" required value={name} onChange={(e) => setName(e.currentTarget.value)} />
        <Group grow>
          <Select
            label="Kategorie"
            required
            data={categories.map((c) => ({ value: c.id, label: c.name }))}
            value={categoryId}
            onChange={setCategoryId}
            allowDeselect={false}
          />
          <NumberInput label="Preis (€)" required min={0} decimalScale={2} fixedDecimalScale decimalSeparator="," value={price} onChange={(v) => setPrice(v === '' ? '' : Number(v))} />
        </Group>
        <Textarea label="Beschreibung" value={description} onChange={(e) => setDescription(e.currentTarget.value)} autosize minRows={2} />
        <Switch label="Aktiv (im Verkauf sichtbar)" checked={active} onChange={(e) => setActive(e.currentTarget.checked)} />

        <Group justify="space-between" mt="sm">
          <Title order={5}>Größen</Title>
          <Menu>
            <Menu.Target>
              <Button size="xs" variant="light" leftSection={<IconPlus size={14} />}>
                Größen hinzufügen
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item onClick={() => setVariants([...variants, { size: '', price: '', min_stock: 0, active: true }])}>Einzelne Größe</Menu.Item>
              <Menu.Divider />
              {Object.keys(SIZE_PRESETS).map((k) => (
                <Menu.Item key={k} onClick={() => addPreset(k)}>
                  Vorlage: {k}
                </Menu.Item>
              ))}
            </Menu.Dropdown>
          </Menu>
        </Group>
        <Table.ScrollContainer minWidth={460}>
          <Table verticalSpacing={4}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Größe</Table.Th>
                <Table.Th>Abw. Preis</Table.Th>
                <Table.Th>Mindestbestand</Table.Th>
                <Table.Th>Bestand</Table.Th>
                <Table.Th>Aktiv</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {variants.map((v, i) => (
                <Table.Tr key={v.id ?? `new-${i}`}>
                  <Table.Td>
                    <TextInput size="xs" w={120} value={v.size} onChange={(e) => setVariants(variants.map((x, j) => (j === i ? { ...x, size: e.currentTarget.value } : x)))} />
                  </Table.Td>
                  <Table.Td>
                    <NumberInput size="xs" w={90} min={0} decimalScale={2} decimalSeparator="," placeholder={String(price || 0)} value={v.price} onChange={(val) => setVariants(variants.map((x, j) => (j === i ? { ...x, price: val === '' ? '' : Number(val) } : x)))} />
                  </Table.Td>
                  <Table.Td>
                    <NumberInput size="xs" w={70} min={0} value={v.min_stock} onChange={(val) => setVariants(variants.map((x, j) => (j === i ? { ...x, min_stock: Number(val || 0) } : x)))} />
                  </Table.Td>
                  <Table.Td>{qtyFor(v.id)}</Table.Td>
                  <Table.Td>
                    <Switch size="xs" checked={v.active} onChange={(e) => setVariants(variants.map((x, j) => (j === i ? { ...x, active: e.currentTarget.checked } : x)))} />
                  </Table.Td>
                  <Table.Td>
                    <ActionIcon variant="subtle" color="red" onClick={() => removeVariant(i)}>
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
        <Text size="xs" c="dimmed">
          „Abw. Preis“ leer lassen = Produktpreis. Bestand wird unter „Bestand“ per Wareneingang gebucht.
        </Text>

        <Group justify="space-between" mt="sm">
          <Title order={5}>Produktbilder</Title>
          <FileButton onChange={(f) => void upload(f)} accept="image/*" multiple disabled={!product}>
            {(props) => (
              <Button {...props} size="xs" variant="light" leftSection={<IconCamera size={14} />} loading={uploading} disabled={!product}>
                Bild hinzufügen
              </Button>
            )}
          </FileButton>
        </Group>
        {!product && <Text size="sm" c="dimmed">Bilder können nach dem ersten Speichern hinzugefügt werden.</Text>}
        {product && images.length === 0 && <Text size="sm" c="dimmed">Noch keine Bilder. Am Handy kann direkt ein Foto aufgenommen werden.</Text>}
        <SimpleGrid cols={{ base: 2, xs: 3 }}>
          {images.map((img) => (
            <Card key={img.id} withBorder padding={4}>
              <Image src={imageUrl(img.path)} h={110} fit="cover" radius="sm" alt="" />
              <Group justify="space-between" mt={4} gap={0}>
                <Tooltip label={img.is_main ? 'Hauptbild' : 'Als Hauptbild festlegen'}>
                  <ActionIcon variant="subtle" color="yellow" onClick={() => !img.is_main && void setMain(img)}>
                    {img.is_main ? <IconStarFilled size={16} /> : <IconStar size={16} />}
                  </ActionIcon>
                </Tooltip>
                <ActionIcon variant="subtle" color="red" onClick={() => deleteImage(img)}>
                  <IconTrash size={16} />
                </ActionIcon>
              </Group>
            </Card>
          ))}
        </SimpleGrid>

        <Group justify="space-between" mt="md">
          {product ? (
            <Menu>
              <Menu.Target>
                <ActionIcon variant="subtle" size="lg">
                  <IconDots />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item color="red" leftSection={<IconTrash size={14} />} onClick={deleteProduct}>
                  Produkt löschen
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          ) : (
            <span />
          )}
          <Group>
            <Button variant="default" onClick={onClose}>
              Schließen
            </Button>
            <Button onClick={save} loading={busy} disabled={!name.trim() || !categoryId || variants.length === 0}>
              Speichern
            </Button>
          </Group>
        </Group>
      </Stack>
    </Drawer>
  );
}

