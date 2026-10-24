// Renders the /join/:token List invitation page from invite-fallback.html.
// The data-invite-meta / data-invite-slot attributes mark what is replaced, so
// wording changes in the template cannot silently break the injection.
//
// Three outcomes:
//   preview - the link works: "Join <List>" with its item count, Open in StockUp
//   dead    - reset, turned off or never existed (404): no open button
//   unknown - the data could not be reached: the generic template, still
//             openable, because calling a working link dead would be worse
//
// An openable page's button is linked here (stockup://join/<token>), not only
// by the page's script, so it shows and works without it. The template's
// button is hidden and links nowhere.

import { escapeHtml, truncate } from './product';
import { fetchInvitePreview, INVITE_TOKEN_RE, type InvitePreview } from './invite';

interface AssetsEnv {
  ASSETS: { fetch: typeof fetch };
}

export type InviteState =
  | { kind: 'preview'; preview: InvitePreview }
  | { kind: 'dead' }
  | { kind: 'unknown' };

const CANONICAL_ORIGIN = 'https://stockup.au';

function replaceMeta(html: string, slot: string, replacement: string): string {
  const tag = slot === 'title' ? 'title' : slot === 'canonical' ? 'link' : 'meta';
  const close = tag === 'title' ? '[\\s\\S]*?<\\/title>' : '';
  const pattern = new RegExp(`<${tag}\\b(?=[^>]*\\bdata-invite-meta="${slot}")[^>]*>${close}`, 'i');
  if (!pattern.test(html)) throw new Error(`Missing invite metadata slot: ${slot}`);
  return html.replace(pattern, replacement);
}

/** Replaces a slot element's text, or removes the element when `text` is null. */
function replaceSlot(html: string, slot: string, text: string | null): string {
  const pattern = new RegExp(
    `<(\\w+)\\b([^>]*\\bdata-invite-slot="${slot}"[^>]*)>[\\s\\S]*?<\\/\\1>`,
    'i',
  );
  if (!pattern.test(html)) throw new Error(`Missing invite body slot: ${slot}`);
  return html.replace(pattern, (_m, tag: string, attrs: string) =>
    text === null ? '' : `<${tag}${attrs}>${escapeHtml(text)}</${tag}>`,
  );
}

/** Links the open button to the app and shows it. */
function linkOpenButton(html: string, token: string): string {
  const pattern = /<a\b([^>]*\bdata-invite-slot="open"[^>]*)>([\s\S]*?)<\/a>/i;
  if (!pattern.test(html)) throw new Error('Missing invite body slot: open');
  const href = escapeHtml(`stockup://join/${token}`);
  return html.replace(pattern, (_m, attrs: string, text: string) => {
    const linked = attrs.replace(/\shref="[^"]*"/, ` href="${href}"`).replace(/\shidden(?=\s|$)/, '');
    return `<a${linked}>${text}</a>`;
  });
}

// Same words as the app: an item count, and the List's name set off in curly
// quotes (it is user data - "Join My List" would read as an instruction).
const items = (n: number) => `${n} item${n === 1 ? '' : 's'}`;
const quoted = (name: string) => `\u201C${name}\u201D`;

export function injectInvite(template: string, token: string, state: InviteState): string {
  let html = template;
  if (INVITE_TOKEN_RE.test(token)) {
    const pageUrl = `${CANONICAL_ORIGIN}/join/${token}`;
    html = replaceMeta(html, 'canonical', `<link rel="canonical" href="${pageUrl}">`);
    html = replaceMeta(html, 'og:url', `<meta property="og:url" content="${pageUrl}">`);
    if (state.kind !== 'dead') html = linkOpenButton(html, token);
  }

  if (state.kind === 'unknown') return html;

  if (state.kind === 'dead') {
    const title = "This invitation doesn't work any more - StockUp";
    const description = 'Ask the person who shared it for a new link.';
    for (const [slot, value] of [
      ['title', `<title>${escapeHtml(title)}</title>`],
      ['description', `<meta name="description" content="${escapeHtml(description)}">`],
      ['og:title', `<meta property="og:title" content="${escapeHtml(title)}">`],
      ['og:description', `<meta property="og:description" content="${escapeHtml(description)}">`],
      ['twitter:title', `<meta name="twitter:title" content="${escapeHtml(title)}">`],
      ['twitter:description', `<meta name="twitter:description" content="${escapeHtml(description)}">`],
    ] as const) {
      html = replaceMeta(html, slot, value);
    }
    html = replaceSlot(html, 'heading', "This invitation doesn't work any more");
    html = replaceSlot(html, 'detail', 'Ask the person who shared it for a new link.');
    html = replaceSlot(html, 'open', null);
    return replaceSlot(html, 'hint', null);
  }

  const name = truncate(state.preview.name, 40);
  const count = items(state.preview.itemCount);
  const title = escapeHtml(`Join ${quoted(name)} on StockUp`);
  const description = escapeHtml(
    `${count} on a shared list. Join it in StockUp to add and remove items together.`,
  );
  for (const [slot, value] of [
    ['title', `<title>${title}</title>`],
    ['description', `<meta name="description" content="${description}">`],
    ['og:title', `<meta property="og:title" content="${title}">`],
    ['og:description', `<meta property="og:description" content="${description}">`],
    ['twitter:title', `<meta name="twitter:title" content="${title}">`],
    ['twitter:description', `<meta name="twitter:description" content="${description}">`],
  ] as const) {
    html = replaceMeta(html, slot, value);
  }
  html = replaceSlot(html, 'heading', `Join ${quoted(name)}`);
  return replaceSlot(html, 'detail', `${count} on a shared list. Open StockUp to join it.`);
}

export async function renderInvitePage(
  token: string,
  env: AssetsEnv,
  request: Request,
): Promise<Response> {
  let state: InviteState;
  if (!INVITE_TOKEN_RE.test(token)) {
    state = { kind: 'dead' };
  } else {
    try {
      const preview = await fetchInvitePreview(token);
      state = preview ? { kind: 'preview', preview } : { kind: 'dead' };
    } catch {
      state = { kind: 'unknown' };
    }
  }
  const headers = {
    'Content-Type': 'text/html; charset=utf-8',
    // A reset or turned-off link must stop advertising the List at once.
    'Cache-Control': 'no-store',
    'X-Robots-Tag': 'noindex',
  };
  const status = state.kind === 'dead' ? 404 : 200;
  if (request.method === 'HEAD') return new Response(null, { status, headers });

  const templateRes = await env.ASSETS.fetch(new URL('/invite-fallback', request.url));
  const template = await templateRes.text();
  return new Response(injectInvite(template, token, state), { status, headers });
}
