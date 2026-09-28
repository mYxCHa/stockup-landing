// The Pages version of the install handoff uses the same mobile routing as
// the deployed Worker. Desktop keeps the existing static fallback page.

import { installFallback, installRedirect } from './_lib/get';

export const onRequest: PagesFunction = async (context) => {
  if (context.request.method !== 'GET' && context.request.method !== 'HEAD') {
    return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
  }
  const redirect = installRedirect(context.request);
  if (redirect) return redirect;
  return installFallback(await context.next(), context.request.method);
};
