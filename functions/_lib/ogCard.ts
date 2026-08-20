// Renders /og/product/:id.png - the product share card (R33): product name,
// both prices (cheapest first, retailer-coloured), the savings gap, and the
// product image when its CDN cooperates. 1200×630, brand navy, Inter.
//
// Rendering is workers-og (satori + resvg-wasm). Fonts are the self-hosted
// Inter TTFs under /assets/fonts (fetched via ASSETS - no third-party
// round-trip). Unknown ids and hard failures degrade to the static generic
// OG card, HTTP 200, so crawlers always get an image.
//
// Shared by the Pages Function (functions/og/product/[id].ts) and the deployed
// Worker (worker.ts); the Worker is what actually runs under this project's
// Worker + static-assets model.

import { ImageResponse } from 'workers-og';
import {
  fetchProduct,
  formatPrice,
  pricePairs,
  priceGap,
  truncate,
  type ProductRow,
} from './product';

interface AssetsEnv {
  ASSETS: { fetch: typeof fetch };
}

const NAVY = '#1B3A5C';
const MUTED = '#93A8C4';
const YELLOW = '#FFD814';
const RETAILER_COLOR: Record<'coles' | 'woolworths', string> = {
  coles: '#E50016',
  woolworths: '#129C4F',
};

// Module-scope cache survives across invocations on a warm isolate.
let fontsPromise: Promise<
  { name: string; data: ArrayBuffer; weight: 400 | 700; style: 'normal' }[]
> | null = null;

function loadFonts(env: AssetsEnv, requestUrl: string) {
  fontsPromise ??= (async () => {
    const [regular, bold] = await Promise.all([
      env.ASSETS.fetch(new URL('/assets/fonts/Inter-Regular.ttf', requestUrl)),
      env.ASSETS.fetch(new URL('/assets/fonts/Inter-Bold.ttf', requestUrl)),
    ]);
    return [
      { name: 'Inter', data: await regular.arrayBuffer(), weight: 400 as const, style: 'normal' as const },
      { name: 'Inter', data: await bold.arrayBuffer(), weight: 700 as const, style: 'normal' as const },
    ];
  })();
  return fontsPromise;
}

async function fetchImageDataUri(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(2000),
      headers: {
        // Woolies' media CDN 403s CLI-looking user agents; a browser UA
        // satisfies both retailers' CDNs.
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
      },
    });
    if (!res.ok) return null;
    let type = (res.headers.get('content-type') ?? 'image/jpeg').split(';')[0].trim();
    // Coles' CDN serves the non-standard `image/jpg`, which satori's data-URI
    // parser rejects with an opaque "s is not iterable" mid-stream.
    if (type === 'image/jpg') type = 'image/jpeg';
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(type)) {
      return null;
    }
    const buf = await res.arrayBuffer();
    if (buf.byteLength > 2_000_000) return null; // keep satori's input sane
    let binary = '';
    const bytes = new Uint8Array(buf);
    const chunk = 8192;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return `data:${type};base64,${btoa(binary)}`;
  } catch {
    return null;
  }
}

// workers-og (satori) renders text nodes literally - it does NOT decode HTML
// entities - so card text must carry real glyphs (an apostrophe, not `&#39;`;
// an ampersand, not `&amp;`). Only `<` can break satori-html's tag parse, so
// drop it. This is deliberately the OPPOSITE of the <meta> injection in
// productPage.ts, whose values are browser-parsed HTML and so must stay
// escapeHtml'd.
function cardText(s: string): string {
  return s.replace(/</g, '');
}

function priceChip(pair: { retailer: 'coles' | 'woolworths'; label: string; price: number }): string {
  return `
    <div style="display: flex; flex-direction: column; align-items: center; background: ${RETAILER_COLOR[pair.retailer]}; color: #FFFFFF; border-radius: 20px; padding: 18px 32px;">
      <span style="font-size: 26px; opacity: 0.9;">${pair.label}</span>
      <span style="font-size: 46px; font-weight: 700;">${formatPrice(pair.price)}</span>
    </div>`;
}

function cardHtml(p: ProductRow, imageUri: string | null): string {
  const pairs = pricePairs(p);
  const gap = priceGap(p);
  const name = cardText(truncate(p.name, 70));
  const sizeBits = [
    p.brand ? cardText(p.brand) : null,
    p.size_value != null ? `${p.size_value}${p.size_unit ?? ''}` : null,
  ].filter(Boolean);

  return `
  <div style="display: flex; flex-direction: row; width: 1200px; height: 630px; background: ${NAVY}; padding: 56px 64px; font-family: Inter;">
    <div style="display: flex; flex-direction: column; flex: 1; justify-content: space-between; padding-right: ${imageUri ? '48px' : '0'};">
      <div style="display: flex; align-items: center;">
        <div style="display: flex; width: 18px; height: 18px; border-radius: 9px; background: ${YELLOW}; margin-right: 14px;"></div>
        <span style="font-size: 38px; font-weight: 700; color: #FFFFFF; letter-spacing: -1px;">StockUp</span>
      </div>
      <div style="display: flex; flex-direction: column;">
        <span style="font-size: 52px; font-weight: 700; color: #FFFFFF; line-height: 1.15;">${name}</span>
        ${sizeBits.length ? `<span style="font-size: 26px; color: ${MUTED}; margin-top: 10px;">${sizeBits.join(' · ')}</span>` : ''}
        <div style="display: flex; flex-direction: row; align-items: center; margin-top: 30px;">
          ${pairs.map(priceChip).join('<div style="display: flex; width: 18px;"></div>')}
          ${
            gap
              ? `<div style="display: flex; background: ${YELLOW}; color: ${NAVY}; border-radius: 999px; padding: 14px 26px; margin-left: 22px; font-size: 30px; font-weight: 700;">Save ${formatPrice(gap)}</div>`
              : ''
          }
        </div>
      </div>
      <span style="font-size: 24px; color: ${MUTED};">stockup.au - free price-drop alerts</span>
    </div>
    ${
      imageUri
        ? `<div style="display: flex; align-items: center; justify-content: center; width: 360px; background: #FFFFFF; border-radius: 28px; padding: 24px;">
            <img src="${imageUri}" width="312" height="312" style="object-fit: contain;" />
          </div>`
        : ''
    }
  </div>`;
}

export async function renderProductOgCard(
  id: string,
  env: AssetsEnv,
  requestUrl: string,
): Promise<Response> {
  const genericCard = () =>
    env.ASSETS.fetch(new URL('/assets/og-image.png', requestUrl));

  try {
    const cleanId = id.replace(/\.png$/i, '');
    const product = await fetchProduct(cleanId);
    if (!product) return genericCard();

    const [fonts, imageUri] = await Promise.all([
      loadFonts(env, requestUrl),
      product.image_url ? fetchImageDataUri(product.image_url) : null,
    ]);

    const image = new ImageResponse(cardHtml(product, imageUri), {
      width: 1200,
      height: 630,
      fonts,
    });
    // Buffer before responding: ImageResponse renders lazily into its stream,
    // so a satori/resvg failure after headers are sent would otherwise emit a
    // 0-byte 200. Buffering keeps failures inside this try → generic card.
    const png = await image.arrayBuffer();
    return new Response(png, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      },
    });
  } catch {
    return genericCard();
  }
}
