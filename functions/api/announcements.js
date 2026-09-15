const JSONBIN_BASE = 'https://api.jsonbin.io/v3/b/';
// TODO: replace with real bin IDs once the user provides them
const FALLBACK_IDS = {
  broadcast: '',
  banner: '',
};
const TTL_MINUTES = 10;
const TTL_SECONDS = TTL_MINUTES * 60;

export async function onRequestGet(context) {
  const { request, env, waitUntil } = context;
  const url = new URL(request.url);
  const type = url.searchParams.get('type') === 'banner' ? 'banner' : 'broadcast';
  const binId = (type === 'banner' ? env.BANNER_BIN_ID : env.BROADCAST_BIN_ID) || FALLBACK_IDS[type];

  if (!binId) {
    return new Response(JSON.stringify({ error: 'bin-not-configured' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  const cacheKey = new Request(`${url.origin}/api/announcements?type=${type}`);
  const cache = caches.default;

  let res = await cache.match(cacheKey);
  if (!res) {
    try {
      const upstream = await fetch(`${JSONBIN_BASE}${binId}/latest`, {
        headers: { Accept: 'application/json' },
        cf: { cacheTtl: TTL_SECONDS },
      });
      const body = await upstream.text();
      res = new Response(body, {
        status: upstream.status,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': `public, max-age=${TTL_SECONDS}`,
          'Access-Control-Allow-Origin': '*',
        },
      });
      if (upstream.ok) waitUntil(cache.put(cacheKey, res.clone()));
    } catch {
      res = new Response(JSON.stringify({ error: 'upstream-failed' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }
  }
  return res;
}
