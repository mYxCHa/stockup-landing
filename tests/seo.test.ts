import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('search metadata is parseable and contains no unsupported aggregate rating', () => {
  const html = readFileSync('index.html', 'utf8');
  const script = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(script);
  const graph = JSON.parse(script[1])['@graph'];
  assert.ok(Array.isArray(graph));
  const app = graph.find((node: { '@type': string }) => node['@type'] === 'SoftwareApplication');
  const faq = graph.find((node: { '@type': string }) => node['@type'] === 'FAQPage');
  assert.equal(app.offers.price, '0');
  assert.equal(app.aggregateRating, undefined);
  assert.equal(faq.mainEntity.length, (html.match(/<details class="faq-item">/g) ?? []).length);
});

test('sitemap and crawler policy agree on indexable pages', () => {
  const sitemap = readFileSync('sitemap.xml', 'utf8');
  const robots = readFileSync('robots.txt', 'utf8');
  assert.equal((sitemap.match(/<url>/g) ?? []).length, 3);
  assert.doesNotMatch(sitemap, /\/delete-account|\/get|\/product/);
  assert.doesNotMatch(sitemap, /OWNER|HELD|docs\//);
  assert.doesNotMatch(robots, /^Disallow:/m);
  for (const file of ['get.html', 'product-fallback.html', 'delete-account.html']) {
    assert.match(readFileSync(file, 'utf8'), /<meta name="robots" content="noindex">/);
  }
  assert.match(readFileSync('_headers', 'utf8'), /\/product\/\*\s+[\s\S]*?X-Robots-Tag: noindex/);
});
