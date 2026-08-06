// /get - the one install link that works from anywhere. Reads the
// User-Agent and 302s to the right store: QR codes in the wild, printed
// campaigns and social bios can all point at a single stable URL instead of
// asking the reader to pick a platform.
//
// Desktop has no app to install, so it goes to the homepage download section
// where the badges (and the hero QR) live.
//
// Two headers are load-bearing:
// - `Cache-Control: no-store`, because the response varies by User-Agent and a
//   cached copy would send Android users to the App Store.
// - `X-Robots-Tag: noindex`, because this is plumbing, not a page. robots.txt
//   also disallows it and it is deliberately absent from the sitemap.

const APP_STORE =
  'https://apps.apple.com/au/app/stockup-grocery-prices/id6760887575';

const PLAY_STORE =
  'https://play.google.com/store/apps/details?id=com.myxcha.StockUp&referrer=utm_source%3Dstockup.au';

const DESKTOP_FALLBACK = 'https://stockup.au/#download';

function storeFor(userAgent: string): string {
  if (/iPad|iPhone|iPod/i.test(userAgent)) return APP_STORE;
  if (/Android/i.test(userAgent)) return PLAY_STORE;
  return DESKTOP_FALLBACK;
}

export const onRequestGet: PagesFunction = async (context) => {
  const userAgent = context.request.headers.get('User-Agent') ?? '';

  return new Response(null, {
    status: 302,
    headers: {
      Location: storeFor(userAgent),
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex',
    },
  });
};
