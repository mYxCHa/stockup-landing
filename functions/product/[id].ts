// /product/:id - serves the static product-fallback interstitial with
// per-product Open Graph tags injected (R33). The deep-link / store-redirect
// behaviour is untouched - it lives in the template's inline script.
//
// This function replaced the `_redirects` rewrite (`/product/:id
// /product-fallback 200`): Pages evaluates `_redirects` BEFORE Functions, so
// the rewrite had to be removed for this route to run. On any data failure we
// serve the template unmodified - same behaviour as the old rewrite.

import {
  fetchProduct,
  formatPrice,
  pricePairs,
  priceGap,
  escapeHtml,
  truncate,
  type ProductRow,
} from '../_lib/product';

interface Env {
  ASSETS: { fetch: typeof fetch };
}

function ogDescription(p: ProductRow): string {
  const pairs = pricePairs(p);
  const gap = priceGap(p);
  const priceBit = pairs
    .map((pair) => `${pair.label} ${formatPrice(pair.price)}`)
    .join(' · ');
  const gapBit = gap ? ` - save ${formatPrice(gap)} at ${pairs[0].label}` : '';
  const tail = 'See the price history and get an alert when it drops. Free on StockUp.';
  return priceBit ? `${priceBit}${gapBit}. ${tail}` : tail;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context;
  const templateRes = await env.ASSETS.fetch(
    new URL('/product-fallback', request.url),
  );
  const template = await templateRes.text();

  let product: ProductRow | null = null;
  try {
    const id = String(params.id ?? '');
    product = await fetchProduct(id);
  } catch {
    // Data outage → generic card, exactly what the old static rewrite served.
  }

  const html = product ? injectMeta(template, product, request.url) : template;
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // Prices refresh weekly (Wednesdays); a day of caching is safe and
      // keeps crawler re-scrapes cheap.
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  });
};

function injectMeta(template: string, p: ProductRow, requestUrl: string): string {
  const origin = new URL(requestUrl).origin;
  const title = escapeHtml(truncate(p.name, 90));
  const desc = escapeHtml(ogDescription(p));
  const ogImage = `${origin}/og/product/${encodeURIComponent(p.product_id)}.png`;
  const pageUrl = `${origin}/product/${encodeURIComponent(p.product_id)}`;

  return template
    .replace(
      '<title>StockUp - View Product</title>',
      `<title>${title} - StockUp</title>`,
    )
    .replace(
      '<meta name="description" content="Compare Coles and Woolworths prices for this product on StockUp.">',
      `<meta name="description" content="${desc}">`,
    )
    .replace(
      '<meta property="og:title" content="StockUp - Compare Grocery Prices">',
      `<meta property="og:title" content="${title}">`,
    )
    .replace(
      '<meta property="og:description" content="Compare Coles and Woolworths prices side-by-side. Tap to view this product in StockUp.">',
      `<meta property="og:description" content="${desc}">\n  <meta property="og:url" content="${pageUrl}">`,
    )
    .replace(
      '<meta property="og:image" content="https://stockup.au/assets/og-image.png">',
      `<meta property="og:image" content="${ogImage}">`,
    )
    .replace(
      '<meta name="twitter:image" content="https://stockup.au/assets/og-image.png">',
      `<meta name="twitter:image" content="${ogImage}">`,
    );
}
