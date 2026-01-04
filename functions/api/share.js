import { jsonResponse, parseJson } from '../_lib/utils.js';

const ONE_DAY = 60 * 60 * 24;

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }
  if (!env.APP_KV) {
    return jsonResponse({ message: 'KV 설정이 필요합니다.' }, 500);
  }

  const body = await parseJson(request);
  if (!body) {
    return jsonResponse({ message: '잘못된 요청입니다.' }, 400);
  }

  const amount = Number(body.amount);
  const direction = body.direction === 'refund' || body.direction === 'payment'
    ? body.direction
    : null;
  const label = typeof body.label === 'string' && body.label.length <= 120 ? body.label : null;

  if (!Number.isFinite(amount) || amount < 0 || !direction) {
    return jsonResponse({ message: '공유 데이터를 확인해 주세요.' }, 400);
  }

  const id = crypto.randomUUID().replace(/-/g, '');
  const payload = {
    amount,
    direction,
    label,
    createdAt: Date.now(),
  };

  await env.APP_KV.put(`share:${id}`, JSON.stringify(payload), { expirationTtl: ONE_DAY });

  const origin = new URL(request.url).origin;
  return jsonResponse({
    id,
    url: `${origin}/share/${id}`,
  });
}
