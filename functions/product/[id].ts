// /product/:id - serves the static product-fallback interstitial with
// per-product Open Graph tags injected (R33). The deep-link / store-redirect
// behaviour is untouched - it lives in the template's inline script.
//
// The logic lives in ../_lib/productPage so the deployed Worker (worker.ts)
// and this Pages Function share one implementation. Under this project's
// Worker + static-assets deploy model the Worker is what actually serves this
// route; this Function is kept working for a possible future Pages deploy.

import { renderProductPage } from '../_lib/productPage';

interface Env {
  ASSETS: { fetch: typeof fetch };
}

export const onRequestGet: PagesFunction<Env> = ({ request, env, params }) =>
  renderProductPage(String(params.id ?? ''), env, request.url);
