const ALTERNATE_HOSTS = new Set([
  'www.stockup.au',
  'stockupapp.com.au',
  'www.stockupapp.com.au',
]);

/** Keep app-association files on their original host for installed app links. */
export function canonicalHostRedirect(request: Request): Response | null {
  if (request.method !== 'GET' && request.method !== 'HEAD') return null;
  const url = new URL(request.url);
  if (!ALTERNATE_HOSTS.has(url.hostname)) return null;
  if (url.pathname.startsWith('/.well-known/')) return null;
  url.hostname = 'stockup.au';
  url.protocol = 'https:';
  return new Response(null, {
    status: 308,
    headers: {
      Location: url.toString(),
      'Cache-Control': 'public, max-age=300',
    },
  });
}
