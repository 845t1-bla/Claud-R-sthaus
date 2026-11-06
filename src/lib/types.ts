export type Condition = 'neu' | 'gebraucht_flat' | 'haertefall';
export type SaleType = 'verkauf' | 'flat_ausgabe' | 'flat_tausch';
export type Assessment = 'sauber' | 'beschaedigt_ok' | 'unbrauchbar';

export interface Staff {
  id: string;
  user_id: string | null;
  name: string;
  email: string | null;
  role: 'admin' | 'ausgeber';
  active: boolean;
}

export interface Member {
  id: string;
  first_name: string;
  last_name: string;
  group_name: string | null;
  contact: string | null;
  notes: string | null;
  active: boolean;
  created_at?: string;
}

export interface Category {
  id: string;
  name: string;
  sort: number;
  is_kluft: boolean;
}

export interface ProductImage {
  id: string;
  product_id: string;
  path: string;
  sort: number;
  is_main: boolean;
}

export interface Variant {
  id: string;
  product_id: string;
  size: string;
  price: number | null;
  min_stock: number;
  sort: number;
  active: boolean;
}

export interface Product {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  price: number;
  active: boolean;
  categories?: Category | null;
  variants: Variant[];
  product_images: ProductImage[];
}

export interface StockRow {
  variant_id: string;
  product_id: string;
  product_name: string;
  category_id: string;
  category_name: string;
  category_sort: number;
  size: string;
  variant_sort: number;
  condition: Condition;
  quantity: number;
  price: number;
  min_stock: number;
  active: boolean;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  variant_id: string;
  condition: Condition;
  quantity: number;
  list_price: number;
  unit_price: number;
  reason: string | null;
  is_flat_component: boolean;
  is_flat_kluft: boolean;
  variants?: { size: string; products: { id: string; name: string } | null } | null;
}

export interface SaleChange {
  id: string;
  changed_at: string;
  description: string;
  staff?: { name: string } | null;
}

export interface Sale {
  id: string;
  sale_date: string;
  created_at: string;
  member_id: string;
  staff_id: string;
  type: SaleType;
  payment: string;
  note: string | null;
  flat_fee: number;
  fee_reason: string | null;
  total: number;
  flat_contract_id: string | null;
  cancelled: boolean;
  cancelled_at: string | null;
  cancel_reason: string | null;
  members?: Pick<Member, 'first_name' | 'last_name' | 'group_name'> | null;
  staff?: { name: string } | null;
  sale_items: SaleItem[];
  sale_changes?: SaleChange[];
}

export interface FlatContract {
  id: string;
  member_id: string;
  started_at: string;
  status: 'aktiv' | 'beendet' | 'storniert';
  current_variant_id: string | null;
  fee_paid: number;
  ended_at: string | null;
  note: string | null;
  members?: Pick<Member, 'first_name' | 'last_name' | 'group_name'> | null;
  variants?: { size: string; products: { name: string } | null } | null;
  flat_returns?: FlatReturn[];
}

export interface FlatReturn {
  id: string;
  created_at: string;
  return_date: string;
  contract_id: string;
  variant_id: string;
  assessment: Assessment;
  note: string | null;
  staff?: { name: string } | null;
  variants?: { size: string; products: { name: string } | null } | null;
}

export interface FlatPatchDefault {
  id: string;
  variant_id: string;
  quantity: number;
  sort: number;
}

export interface StockMovement {
  id: string;
  created_at: string;
  variant_id: string;
  condition: Condition;
  delta: number;
  kind: string;
  reason: string | null;
  sale_id: string | null;
  staff?: { name: string } | null;
  variants?: { size: string; products: { name: string } | null } | null;
}
