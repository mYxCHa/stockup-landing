// Renders /og/product/:id.png - the product share card (R33): product name,
// available prices (cheapest first, retailer-coloured), the price gap, and the
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
import { fetchProduct } from './product';
import { cardHtml } from './ogMarkup';

interface AssetsEnv {
  ASSETS: { fetch: typeof fetch };
}

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

    const render = (uri: string | null) =>
      new ImageResponse(cardHtml(product, uri), {
        width: 1200,
        height: 630,
        fonts,
      }).arrayBuffer();
    // Buffer before responding because ImageResponse renders lazily. Some
    // retailer JPEGs cannot be decoded by satori; retry the same price card
    // without its product photo before falling back to the generic brand card.
    let png: ArrayBuffer;
    try {
      png = await render(imageUri);
    } catch (error) {
      if (!imageUri) throw error;
      console.warn('Product OG image omitted after render failure', id, error instanceof Error ? error.message : String(error));
      png = await render(null);
    }
    return new Response(png, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      },
    });
  } catch (error) {
    console.error('Product OG card render failed', id, error instanceof Error ? error.message : String(error));
    return genericCard();
  }
}

export function productOgHead(): Response {
  return new Response(null, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
    },
  });
}
