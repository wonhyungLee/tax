const encoder = new TextEncoder();

export const jsonResponse = (payload, status = 200, headers = {}) => {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...headers,
    },
  });
};

export const parseJson = async (request) => {
  try {
    return await request.json();
  } catch (error) {
    return null;
  }
};

const toHex = (buffer) =>
  Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

export const hashText = async (text) => {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(text));
  return toHex(digest);
};

export const hashPassword = async (password, pepper = '') => {
  return hashText(`${password}:${pepper}`);
};

export const getClientIp = (request) => {
  const raw =
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('x-forwarded-for') ||
    request.headers.get('x-real-ip') ||
    'unknown';
  return raw.split(',')[0].trim();
};

export const getIpHash = async (request, pepper = '') => {
  const ip = getClientIp(request);
  return hashText(`${ip}:${pepper}`);
};

const MIN_KV_TTL_SECONDS = 60;

export const checkRateLimit = async (env, key, ttlSeconds) => {
  if (!env.APP_KV) return true;
  const existing = await env.APP_KV.get(key);
  if (existing) return false;
  const ttl = Math.max(ttlSeconds || 0, MIN_KV_TTL_SECONDS);
  await env.APP_KV.put(key, '1', { expirationTtl: ttl });
  return true;
};

export const requireEnv = (env, key) => {
  if (!env[key]) {
    throw new Error(`${key} is not set`);
  }
  return env[key];
};
