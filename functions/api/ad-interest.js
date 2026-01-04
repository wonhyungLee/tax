import { jsonResponse, parseJson } from '../_lib/utils.js';

const VALID_CATEGORIES = new Set([
  'card',
  'insurance',
  'health',
  'education',
  'housing',
  'pension',
  'donation',
  'finance',
]);

export async function onRequest({ request, env }) {
  if (!env.DB) {
    return jsonResponse({ message: 'DB 설정이 필요합니다.' }, 500);
  }

  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const body = await parseJson(request);
  if (!body) return jsonResponse({ message: '잘못된 요청입니다.' }, 400);
  const category = typeof body.category === 'string' ? body.category : '';
  if (!VALID_CATEGORIES.has(category)) {
    return jsonResponse({ message: '잘못된 카테고리입니다.' }, 400);
  }

  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO ad_interest (category, count, updated_at)
     VALUES (?, 1, ?)
     ON CONFLICT(category)
     DO UPDATE SET count = count + 1, updated_at = ?`
  )
    .bind(category, now, now)
    .run();

  return jsonResponse({ success: true });
}
