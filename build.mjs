// Stage only explicitly approved public files. The Worker and Pages Functions
// are bundled separately from the repository root by Cloudflare.
import { execFileSync } from 'node:child_process';
import { mkdirSync, copyFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const OUT = 'dist';
export const PUBLIC_FILES = [
  '.well-known/apple-app-site-association',
  '.well-known/assetlinks.json',
  '_headers',
  '_redirects',
  'app-ads.txt',
  'delete-account.html',
  'get.html',
  'index.html',
  'llms.txt',
  'privacy-policy.html',
  'product-fallback.html',
  'invite-fallback.html',
  'robots.txt',
  'sitemap.xml',
  'style.css',
  'terms-of-service.html',
  'assets/Home Screen.png',
  'assets/Price Comparison.png',
  'assets/Product Details.png',
  'assets/Search.png',
  'assets/Shopping List.png',
  'assets/Watchlist.png',
  'assets/app-store-badge.png',
  'assets/avatar-1-v32.webp',
  'assets/avatar-2-v32.webp',
  'assets/avatar-3-v32.webp',
  'assets/cart-split-v33.webp',
  'assets/favicon-v1.png',
  'assets/favicon.png',
  'assets/fonts/Inter-Bold.ttf',
  'assets/fonts/Inter-Regular.ttf',
  'assets/fonts/inter-latin-var-v31.woff2',
  'assets/google-play-badge.png',
  'assets/home-screen-v31.webp',
  'assets/logo-v1.png',
  'assets/logo.png',
  'assets/og-image-v1.png',
  'assets/og-image.png',
  'assets/past-purchases-v31.webp',
  'assets/price-alert-v32.webp',
  'assets/product-details-v31.webp',
  'assets/qr-get-v31.svg',
  'assets/quick-cart-v33.webp',
  'assets/screenshot.png',
  'assets/search-compare-v32.webp',
  'assets/smart-shop-v32.webp',
  'assets/specials-v32.webp',
  'assets/search-compare-v36.webp',
  'assets/search-compare-v36-2x.webp',
  'assets/specials-v36.webp',
  'assets/specials-v36-2x.webp',
  'assets/price-alert-v36.webp',
  'assets/price-alert-v36-2x.webp',
  'assets/price-history-v36.webp',
  'assets/price-history-v36-2x.webp',
  'assets/cart-split-v36.webp',
  'assets/cart-split-v36-2x.webp',
  'assets/smart-shop-v36.webp',
  'assets/smart-shop-v36-2x.webp',
  'assets/quick-cart-v36.webp',
  'assets/quick-cart-v36-2x.webp',
  'assets/search-compare-v36-r2.webp',
  'assets/search-compare-v36-r2-2x.webp',
  'assets/specials-v36-r2.webp',
  'assets/specials-v36-r2-2x.webp',
  'assets/price-history-v36-r2.webp',
  'assets/price-history-v36-r2-2x.webp',
];

const tracked = new Set(
  execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
    .split('\0')
    .filter(Boolean),
);
for (const file of PUBLIC_FILES) {
  if (!tracked.has(file)) throw new Error(`Public asset is not tracked: ${file}`);
}

rmSync(OUT, { recursive: true, force: true });
for (const file of PUBLIC_FILES) {
  const destination = join(OUT, file);
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(file, destination);
}

// Defence in depth for an accidental future instruction-file copy.
writeFileSync(join(OUT, '.assetsignore'), 'AGENTS.md\nCLAUDE.md\n');
console.log(`Staged ${PUBLIC_FILES.length} public files into ${OUT}/`);
