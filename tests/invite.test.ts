import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fetchInvitePreview } from '../functions/_lib/invite';
import { injectInvite, renderInvitePage } from '../functions/_lib/invitePage';

const template = readFileSync('invite-fallback.html', 'utf8');
const token = 'NFCRAMoyh4sCXw_tiRRanQ';
const env = { ASSETS: { fetch: async () => new Response(template) } };

async function withFetch<T>(impl: typeof fetch, run: () => Promise<T>): Promise<T> {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  try {
    return await run();
  } finally {
    globalThis.fetch = original;
  }
}

test('a working link names the List and its item count, escaped, and stays openable', () => {
  const html = injectInvite(template, token, {
    kind: 'preview',
    preview: { name: 'Mum & <Dad>\'s "BBQ"', itemCount: 1 },
  });
  assert.match(html, /<title>Join Mum &amp; &lt;Dad&gt;&#39;s &quot;BBQ&quot; on StockUp<\/title>/);
  assert.match(html, /<h1 class="heading" data-invite-slot="heading">Join Mum &amp; &lt;Dad&gt;/);
  assert.match(html, /1 product on a shared list\. Open StockUp to join it\./);
  assert.match(html, /<link rel="canonical" href="https:\/\/stockup\.au\/join\/NFCRAMoyh4sCXw_tiRRanQ">/);
  assert.match(html, /<meta property="og:url" content="https:\/\/stockup\.au\/join\/NFCRAMoyh4sCXw_tiRRanQ">/);
  assert.match(html, /id="open-app"/);
  assert.doesNotMatch(html, /data-invite-meta=/);
});

test('a dead link says so and offers nothing to open', () => {
  const html = injectInvite(template, token, { kind: 'dead' });
  assert.match(html, /This invitation doesn&#39;t work any more/);
  assert.match(html, /Ask the person who shared it for a new link\./);
  assert.doesNotMatch(html, /id="open-app"/);
  assert.doesNotMatch(html, /data-invite-slot="hint"/);
});

test('an outage keeps the generic, openable page', () => {
  const html = injectInvite(template, token, { kind: 'unknown' });
  assert.match(html, /You&#39;ve been invited to a list on StockUp|You've been invited to a list on StockUp/);
  assert.match(html, /id="open-app"/);
  assert.match(html, /<link rel="canonical" href="https:\/\/stockup\.au\/join\//);
});

test('a missing slot fails loudly instead of serving generic tags', () => {
  assert.throws(
    () => injectInvite(template.replace('data-invite-slot="detail"', ''), token, {
      kind: 'preview',
      preview: { name: 'BBQ', itemCount: 2 },
    }),
    /Missing invite body slot: detail/,
  );
});

test('renders from the preview RPC: working, dead, outage, bad token, HEAD', async () => {
  const calls: { url: string; body: string }[] = [];
  const ok = await withFetch(async (input, init) => {
    calls.push({ url: String(input), body: String(init?.body) });
    return Response.json({ ok: true, name: 'Groceries', item_count: 12 });
  }, () => renderInvitePage(token, env, new Request(`https://stockup.au/join/${token}`)));
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get('Cache-Control'), 'no-store');
  assert.equal(ok.headers.get('X-Robots-Tag'), 'noindex');
  assert.match(await ok.text(), /Join Groceries/);
  assert.match(calls[0].url, /\/rest\/v1\/rpc\/get_watchlist_invite_preview$/);
  assert.deepEqual(JSON.parse(calls[0].body), { p_token: token });

  const dead = await withFetch(async () => Response.json({ ok: false }),
    () => renderInvitePage(token, env, new Request(`https://stockup.au/join/${token}`)));
  assert.equal(dead.status, 404);
  assert.match(await dead.text(), /doesn&#39;t work any more/);

  const outage = await withFetch(async () => { throw new Error('down'); },
    () => renderInvitePage(token, env, new Request(`https://stockup.au/join/${token}`)));
  assert.equal(outage.status, 200);
  assert.match(await outage.text(), /id="open-app"/);

  let fetched = false;
  const bad = await withFetch(async () => { fetched = true; return Response.json({}); },
    () => renderInvitePage('short', env, new Request('https://stockup.au/join/short')));
  assert.equal(bad.status, 404);
  assert.equal(fetched, false);
  assert.equal(await fetchInvitePreview('../etc'), null);

  const head = await withFetch(async () => Response.json({ ok: true, name: 'G', item_count: 0 }),
    () => renderInvitePage(token, env, new Request(`https://stockup.au/join/${token}`, { method: 'HEAD' })));
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
});

test('app links and crawler hints cover invitations', () => {
  const aasa = JSON.parse(readFileSync('.well-known/apple-app-site-association', 'utf8'));
  assert.deepEqual(aasa.applinks.details[0].paths, ['/product/*', '/join/*']);
  assert.match(readFileSync('_headers', 'utf8'), /\/join\/\*\s+Cache-Control: no-store\s+X-Robots-Tag: noindex/);
  assert.match(template, /<meta name="robots" content="noindex">/);
  assert.doesNotMatch(template, /\u2014/);
});
