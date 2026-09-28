import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { installFallback, installRedirect } from '../functions/_lib/get';
import { canonicalHostRedirect } from '../functions/_lib/host';

test('mobile install routes differ by device and cannot be cached together', () => {
  for (const method of ['GET', 'HEAD']) {
    const ios = installRedirect(new Request('https://stockup.au/get', {
      method,
      headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' },
    }));
    const android = installRedirect(new Request('https://stockup.au/get', {
      method,
      headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 15)' },
    }));
    assert.equal(ios?.status, 302);
    assert.match(ios?.headers.get('Location') ?? '', /apps\.apple\.com/);
    assert.match(android?.headers.get('Location') ?? '', /play\.google\.com/);
    assert.match(android?.headers.get('Location') ?? '', /utm_medium%3Dqr/);
    for (const response of [ios, android]) {
      assert.equal(response?.headers.get('Cache-Control'), 'no-store');
      assert.equal(response?.headers.get('X-Robots-Tag'), 'noindex');
      assert.equal(response?.headers.get('Vary'), 'User-Agent');
    }
  }
});

test('desktop retains the current manual install page', async () => {
  const request = new Request('https://stockup.au/get', { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh)' } });
  assert.equal(installRedirect(request), null);
  const fallback = installFallback(new Response('<p>Get StockUp</p>'), 'GET');
  assert.equal(fallback.status, 200);
  assert.equal(fallback.headers.get('X-Robots-Tag'), 'noindex');
  assert.equal(await fallback.text(), '<p>Get StockUp</p>');
  assert.equal(await installFallback(new Response('body'), 'HEAD').text(), '');
});

test('alternate hosts redirect paths and queries but keep association files', () => {
  const config = JSON.parse(readFileSync('wrangler.jsonc', 'utf8'));
  assert.equal(config.assets.run_worker_first, true);
  for (const host of ['www.stockup.au', 'stockupapp.com.au', 'www.stockupapp.com.au']) {
    const redirect = canonicalHostRedirect(new Request(`https://${host}/product/123?ref=share`));
    assert.equal(redirect?.status, 308);
    assert.equal(redirect?.headers.get('Location'), 'https://stockup.au/product/123?ref=share');
    assert.equal(canonicalHostRedirect(new Request(`https://${host}/.well-known/apple-app-site-association`)), null);
    assert.equal(canonicalHostRedirect(new Request(`https://${host}/.well-known/assetlinks.json`)), null);
  }
  assert.equal(canonicalHostRedirect(new Request('https://stockup.au/')), null);
  assert.equal(canonicalHostRedirect(new Request('https://stockupapp.com.au/waitlist', { method: 'POST' })), null);
});
