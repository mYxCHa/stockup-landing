import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  fetchProduct,
  priceGap,
  pricePairs,
  type ProductRow,
} from '../functions/_lib/product';
import {
  injectProductMeta,
  renderProductPage,
} from '../functions/_lib/productPage';
import { cardHtml } from '../functions/_lib/ogMarkup';

const template = readFileSync('product-fallback.html', 'utf8');
const product: ProductRow = {
  product_id: '9300830070022',
  name: 'Oats & <More> "Family"',
  brand: null,
  size_value: null,
  size_unit: null,
  image_url: null,
  coles_price: 5,
  woolworths_price: 4.5,
  aldi_price: 3.5,
  coles_was_price: null,
  woolworths_was_price: null,
  cheapest: 'aldi',
};

test('product metadata uses available three-retailer prices and escaped slots', () => {
  const html = injectProductMeta(template, product);
  assert.match(html, /<title>Oats &amp; &lt;More&gt; &quot;Family&quot; prices - StockUp<\/title>/);
  assert.match(html, /ALDI \$3\.50 · Woolworths \$4\.50 · Coles \$5\.00/);
  assert.match(html, /<meta property="og:url" content="https:\/\/stockup\.au\/product\/9300830070022">/);
  assert.match(html, /<link rel="canonical" href="https:\/\/stockup\.au\/product\/9300830070022">/);
  assert.match(html, /<meta name="twitter:image" content="https:\/\/stockup\.au\/og\/product\/9300830070022\.png">/);
  assert.doesNotMatch(html, /data-product-meta=/);
  assert.doesNotMatch(html, /Compare Coles, Woolworths and ALDI prices side-by-side/);

  const changedGenericCopy = template.replace('StockUp - Compare Grocery Prices', 'New generic wording');
  assert.match(injectProductMeta(changedGenericCopy, product), /Oats &amp; &lt;More&gt;/);
});

test('ALDI-only, two-price, one-price, and no-price products make honest metadata', () => {
  const aldiOnly = { ...product, coles_price: null, woolworths_price: null };
  assert.deepEqual(pricePairs(aldiOnly).map((pair) => pair.label), ['ALDI']);
  assert.equal(priceGap(aldiOnly), null);
  assert.match(injectProductMeta(template, aldiOnly), /ALDI \$3\.50/);
  assert.doesNotMatch(injectProductMeta(template, aldiOnly), /Coles \$/);

  const twoPrices = { ...product, aldi_price: null };
  assert.deepEqual(pricePairs(twoPrices).map((pair) => pair.label), ['Woolworths', 'Coles']);
  assert.equal(priceGap(twoPrices), 0.5);

  const noPrices = { ...product, coles_price: null, woolworths_price: null, aldi_price: null };
  assert.deepEqual(pricePairs(noPrices), []);
  assert.equal(priceGap(noPrices), null);
  assert.match(injectProductMeta(template, noPrices), /Look for available prices/);
  const aldiCard = cardHtml(aldiOnly, null);
  assert.match(aldiCard, /ALDI/);
  assert.match(aldiCard, /\$3\.50/);
  assert.doesNotMatch(aldiCard, /Price gap/);
  assert.doesNotMatch(aldiCard, /Coles/);
  const threeWayCard = cardHtml(product, null);
  assert.match(threeWayCard, /Price gap \$1\.50/);
});

test('missing metadata slot fails visibly instead of silently serving generic tags', () => {
  assert.throws(
    () => injectProductMeta(template.replace('data-product-meta="og:url"', ''), product),
    /Missing product metadata slot: og:url/,
  );
});

test('invalid ids and upstream outages keep the generic handoff', async () => {
  const originalFetch = globalThis.fetch;
  const env = {
    ASSETS: { fetch: async () => new Response(template) },
  };
  try {
    globalThis.fetch = async () => { throw new Error('upstream down'); };
    assert.equal(await fetchProduct('bad!id'), null);
    for (const id of ['bad!id', product.product_id]) {
      const response = await renderProductPage(id, env, new Request(`https://stockup.au/product/${id}`));
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('X-Robots-Tag'), 'noindex');
      const html = await response.text();
      assert.match(html, /Compare available Coles, Woolworths and ALDI prices/);
      if (id === product.product_id) {
        assert.match(html, /<meta property="og:url" content="https:\/\/stockup\.au\/product\/9300830070022">/);
      }
    }
    const head = await renderProductPage(product.product_id, env, new Request('https://stockup.au/product/9300830070022', { method: 'HEAD' }));
    assert.equal(await head.text(), '');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('a product response has specific metadata when the upstream returns a row', async () => {
  const originalFetch = globalThis.fetch;
  const env = { ASSETS: { fetch: async () => new Response(template) } };
  try {
    globalThis.fetch = async () => Response.json([product]);
    const response = await renderProductPage(product.product_id, env, new Request('https://stockup.au/product/9300830070022'));
    assert.match(await response.text(), /<meta property="og:url" content="https:\/\/stockup\.au\/product\/9300830070022">/);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
