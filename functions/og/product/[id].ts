// /og/product/:id.png - renders the product share card (R33). The logic lives
// in ../../_lib/ogCard so the deployed Worker (worker.ts) and this Pages
// Function share one implementation. Under this project's Worker +
// static-assets deploy model the Worker is what actually serves this route;
// this Function is kept working for a possible future Pages deploy.

import { renderProductOgCard } from '../../_lib/ogCard';

interface Env {
  ASSETS: { fetch: typeof fetch };
}

export const onRequestGet: PagesFunction<Env> = ({ request, env, params }) =>
  renderProductOgCard(String(params.id ?? ''), env, request.url);
