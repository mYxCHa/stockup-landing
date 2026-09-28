const APP_STORE =
  'https://apps.apple.com/au/app/stockup-grocery-prices/id6760887575';
const PLAY_STORE =
  'https://play.google.com/store/apps/details?id=com.myxcha.StockUp&referrer=utm_source%3Dstockup.au%26utm_medium%3Dqr';

/** Mobile install handoff; desktop keeps the existing page with both badges. */
export function installRedirect(request: Request): Response | null {
  const userAgent = request.headers.get('User-Agent') ?? '';
  const location = /iPad|iPhone|iPod/i.test(userAgent)
    ? APP_STORE
    : /Android/i.test(userAgent)
      ? PLAY_STORE
      : null;
  if (!location) return null;
  return new Response(null, {
    status: 302,
    headers: {
      Location: location,
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex',
      Vary: 'User-Agent',
    },
  });
}

/** Preserve the static desktop fallback but keep it out of search results. */
export function installFallback(response: Response, method: string): Response {
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'no-store');
  headers.set('X-Robots-Tag', 'noindex');
  headers.set('Vary', 'User-Agent');
  return new Response(method === 'HEAD' ? null : response.body, {
    status: response.status,
    headers,
  });
}
