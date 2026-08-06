// Shared product-data plumbing for the Pages Functions (R33 dynamic OG cards).
//
// Reads go straight to PostgREST with the PUBLIC anon key - the same key the
// app binary ships with; RLS is what protects the data. `price_comparison`
// grants anon SELECT (verified 2026-07-13), so no session and no new RPC is
// needed here.

const SUPABASE_URL = 'https://xnbswcbdqizmbqbhqlua.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhuYnN3Y2JkcWl6bWJxYmhxbHVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0NDc5MjMsImV4cCI6MjA4ODAyMzkyM30.OBXWTtPrKGaRMrgDu_UbTYxP3NG8VhDngDG_TYsL_Yw';

export interface ProductRow {
  product_id: string;
  name: string;
  brand: string | null;
  size_value: number | null;
  size_unit: string | null;
  image_url: string | null;
  coles_price: number | null;
  woolworths_price: number | null;
  coles_was_price: number | null;
  woolworths_was_price: number | null;
  cheapest: 'coles' | 'woolworths' | 'equal' | null;
}

const SELECT_COLUMNS =
  'product_id,name,brand,size_value,size_unit,image_url,' +
  'coles_price,woolworths_price,coles_was_price,woolworths_was_price,cheapest';

export async function fetchProduct(
  id: string,
  timeoutMs = 3000,
): Promise<ProductRow | null> {
  // Product ids are barcodes / numeric-ish strings; anything exotic is not a
  // real id, so bail before spending a round-trip.
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return null;
  const url =
    `${SUPABASE_URL}/rest/v1/price_comparison` +
    `?select=${SELECT_COLUMNS}&product_id=eq.${encodeURIComponent(id)}&limit=1`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) return null;
  const rows = (await res.json()) as ProductRow[];
  return rows.length ? rows[0] : null;
}

export const formatPrice = (n: number): string =>
  `$${n.toFixed(2)}`;

/** Both prices sorted cheapest-first (empty/one-element when unranged). */
export function pricePairs(
  p: ProductRow,
): { retailer: 'coles' | 'woolworths'; label: string; price: number }[] {
  const pairs: { retailer: 'coles' | 'woolworths'; label: string; price: number }[] = [];
  if (p.coles_price != null)
    pairs.push({ retailer: 'coles', label: 'Coles', price: p.coles_price });
  if (p.woolworths_price != null)
    pairs.push({ retailer: 'woolworths', label: 'Woolies', price: p.woolworths_price });
  pairs.sort((a, b) => a.price - b.price);
  return pairs;
}

/** Cross-retailer gap in dollars, null unless both retailers carry it. */
export function priceGap(p: ProductRow): number | null {
  if (p.coles_price == null || p.woolworths_price == null) return null;
  const gap = Math.abs(p.coles_price - p.woolworths_price);
  return gap >= 0.05 ? gap : null;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`;
}
