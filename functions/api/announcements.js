const JSONBIN_BASE = 'https://api.jsonbin.io/v3/b/';
const FALLBACK_BIN_ID = '6aa9513affd5d160530a2986';
const TTL_MINUTES = 180;
const TTL_SECONDS = TTL_MINUTES * 60;

export async function onRequestGet(context) {
  const { request, env, waitUntil } = context;
  const url = new URL(request.url);
  const binId = env.ANNOUNCEMENTS_BIN_ID || env.BROADCAST_BIN_ID || FALLBACK_BIN_ID;

  if (!binId) {
    return new Response(JSON.stringify({ error: 'bin-not-configured' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  const cacheKey = new Request(`${url.origin}/api/announcements`);
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
