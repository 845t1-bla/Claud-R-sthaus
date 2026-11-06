import { q, supabase } from './supabase';
import type {
  Category,
  FlatContract,
  FlatPatchDefault,
  Member,
  Product,
  Sale,
  Staff,
  StockMovement,
  StockRow,
} from './types';

const sortProduct = (p: Product): Product => ({
  ...p,
  variants: [...(p.variants ?? [])].sort((a, b) => a.sort - b.sort || a.size.localeCompare(b.size)),
  product_images: [...(p.product_images ?? [])].sort((a, b) => Number(b.is_main) - Number(a.is_main) || a.sort - b.sort),
});

export async function loadProducts(): Promise<Product[]> {
  const rows = await q<Product[]>(
    supabase.from('products').select('*, categories(*), variants(*), product_images(*)').order('name'),
  );
  return rows
    .map(sortProduct)
    .sort(
      (a, b) =>
        (a.categories?.sort ?? 0) - (b.categories?.sort ?? 0) || a.name.localeCompare(b.name, 'de'),
    );
}

export const loadCategories = () => q<Category[]>(supabase.from('categories').select('*').order('sort').order('name'));

export const loadMembers = () =>
  q<Member[]>(supabase.from('members').select('*').order('last_name').order('first_name'));

export const loadStaff = () => q<Staff[]>(supabase.from('staff').select('*').order('name'));

export async function loadStock(): Promise<StockRow[]> {
  const rows = await q<StockRow[]>(supabase.from('v_stock').select('*'));
  return rows.sort(
    (a, b) =>
      a.category_sort - b.category_sort ||
      a.product_name.localeCompare(b.product_name, 'de') ||
      a.variant_sort - b.variant_sort ||
      a.size.localeCompare(b.size),
  );
}

export const loadFlatPatchDefaults = () =>
  q<FlatPatchDefault[]>(supabase.from('flat_patch_defaults').select('*').order('sort'));

export async function loadFlatPrice(): Promise<number> {
  const row = await q<{ value: unknown } | null>(
    supabase.from('settings').select('value').eq('key', 'flat_price').maybeSingle(),
  );
  return Number(row?.value ?? 40);
}

export const SALE_SELECT =
  '*, members(first_name,last_name,group_name), staff!sales_staff_id_fkey(name), sale_items(*, variants(size, products(id,name))), sale_changes(*, staff(name))';

export async function loadSales(filter: { from?: string; to?: string; memberId?: string; limit?: number } = {}) {
  let query = supabase.from('sales').select(SALE_SELECT).order('sale_date', { ascending: false }).order('created_at', { ascending: false });
  if (filter.from) query = query.gte('sale_date', filter.from);
  if (filter.to) query = query.lte('sale_date', filter.to);
  if (filter.memberId) query = query.eq('member_id', filter.memberId);
  if (filter.limit) query = query.limit(filter.limit);
  return q<Sale[]>(query);
}

export const loadContracts = () =>
  q<FlatContract[]>(
    supabase
      .from('flat_contracts')
      .select(
        '*, members(first_name,last_name,group_name), variants(size, products(name)), flat_returns(*, staff(name), variants(size, products(name)))',
      )
      .order('started_at', { ascending: false }),
  );

export const loadMovements = (limit = 300) =>
  q<StockMovement[]>(
    supabase
      .from('stock_movements')
      .select('*, staff(name), variants(size, products(name))')
      .order('created_at', { ascending: false })
      .limit(limit),
  );
