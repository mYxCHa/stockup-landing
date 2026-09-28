// Renders the existing /product/:id handoff page with product-specific sharing
// metadata. The data-product-meta attributes in product-fallback.html mark
// replaceable tags, so wording changes cannot silently break the injection.

import {
  fetchProduct,
  formatPrice,
  pricePairs,
  escapeHtml,
  truncate,
  type ProductRow,
} from './product';

interface AssetsEnv {
  ASSETS: { fetch: typeof fetch };
}

const CANONICAL_ORIGIN = 'https://stockup.au';

function ogDescription(p: ProductRow): string {
  const prices = pricePairs(p)
    .map(({ label, price }) => `${label} ${formatPrice(price)}`)
    .join(' · ');
  if (!prices) {
    return 'Look for available prices and set free price alerts for this product in StockUp. Coverage and prices can vary by store.';
  }
  return `${prices}. Compare available prices and set free price alerts in StockUp. Prices can vary by store.`;
}

function replaceSlot(html: string, slot: string, replacement: string): string {
  const tag = slot === 'title' ? 'title' : slot === 'canonical' ? 'link' : 'meta';
  const close = tag === 'title' ? '[\\s\\S]*?<\\/title>' : '';
  const pattern = new RegExp(`<${tag}\\b(?=[^>]*\\bdata-product-meta="${slot}")[^>]*>${close}`, 'i');
  if (!pattern.test(html)) throw new Error(`Missing product metadata slot: ${slot}`);
  return html.replace(pattern, replacement);
}

export function injectFallbackRouteMeta(template: string, id: string): string {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return template;
  const pageUrl = `${CANONICAL_ORIGIN}/product/${encodeURIComponent(id)}`;
  template = replaceSlot(template, 'canonical', `<link rel="canonical" href="${pageUrl}">`);
  return replaceSlot(template, 'og:url', `<meta property="og:url" content="${pageUrl}">`);
}

export function injectProductMeta(template: string, p: ProductRow): string {
  const title = escapeHtml(`${truncate(p.name, 83)} prices - StockUp`);
  const description = escapeHtml(ogDescription(p));
  const productId = encodeURIComponent(p.product_id);
  const pageUrl = `${CANONICAL_ORIGIN}/product/${productId}`;
  const imageUrl = `${CANONICAL_ORIGIN}/og/product/${productId}.png`;
  const replacements: Record<string, string> = {
    title: `<title>${title}</title>`,
    description: `<meta name="description" content="${description}">`,
    canonical: `<link rel="canonical" href="${pageUrl}">`,
    'og:title': `<meta property="og:title" content="${title}">`,
    'og:description': `<meta property="og:description" content="${description}">`,
    'og:url': `<meta property="og:url" content="${pageUrl}">`,
    'og:image': `<meta property="og:image" content="${imageUrl}">`,
    'twitter:title': `<meta name="twitter:title" content="${title}">`,
    'twitter:description': `<meta name="twitter:description" content="${description}">`,
    'twitter:image': `<meta name="twitter:image" content="${imageUrl}">`,
  };
  for (const [slot, replacement] of Object.entries(replacements)) {
    template = replaceSlot(template, slot, replacement);
  }
  return template;
}

export async function renderProductPage(
  id: string,
  env: AssetsEnv,
  request: Request,
): Promise<Response> {
  const headers = {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Robots-Tag': 'noindex',
  };
  if (request.method === 'HEAD') return new Response(null, { headers });

  const templateRes = await env.ASSETS.fetch(
    new URL('/product-fallback', request.url),
  );
  const template = await templateRes.text();

  let product: ProductRow | null = null;
  try {
    product = await fetchProduct(id);
  } catch {
    // Data outage: serve the generic handoff and static share card.
  }

  return new Response(product ? injectProductMeta(template, product) : injectFallbackRouteMeta(template, id), {
    headers,
  });
}
