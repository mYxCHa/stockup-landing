// List invitation preview for the /join/:token page.
//
// Calls the app's `get_watchlist_invite_preview(p_token)` RPC with the PUBLIC
// anon key. It is the one List call the anon role may make (StockUp migration
// 20261018000000), and it returns only the List's name and item count - the
// owner's decision for what a forwarded link may reveal. A dead link (reset,
// turned off, never existed) answers `{ ok: false }`.

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase';

export interface InvitePreview {
  name: string;
  itemCount: number;
}

/** The app's own token rule (utils/watchlists.ts): 16-64 url-safe chars. */
export const INVITE_TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;

/**
 * The List behind an invitation token: the preview, `null` when the link is
 * dead, or a thrown error when the data could not be reached (the page then
 * shows its generic copy rather than calling a working link dead).
 */
export async function fetchInvitePreview(
  token: string,
  timeoutMs = 3000,
): Promise<InvitePreview | null> {
  if (!INVITE_TOKEN_RE.test(token)) return null;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_watchlist_invite_preview`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_token: token }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`invite preview ${res.status}`);
  const body = (await res.json()) as { ok?: unknown; name?: unknown; item_count?: unknown };
  if (body?.ok !== true || typeof body.name !== 'string') return null;
  return {
    name: body.name,
    itemCount: typeof body.item_count === 'number' ? body.item_count : 0,
  };
}
