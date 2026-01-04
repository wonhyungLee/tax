import { jsonResponse, parseJson, hashPassword, getIpHash, checkRateLimit } from '../_lib/utils.js';
import { containsForbiddenContent } from '../_lib/filter.js';
import { MAX_TITLE, MAX_CONTENT, validateText } from '../_lib/board.js';

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const POST_COOLDOWN_SECONDS = 10;

export async function onRequest({ request, env }) {
  if (!env.DB) {
    return jsonResponse({ message: 'DB 설정이 필요합니다.' }, 500);
  }

  if (request.method === 'GET') {
    const url = new URL(request.url);
    const limit = clamp(parseInt(url.searchParams.get('limit') || '10', 10), 1, 20);
    const offset = Math.max(0, parseInt(url.searchParams.get('offset') || '0', 10));

    const result = await env.DB.prepare(
      `SELECT p.id, p.title, p.created_at,
        (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS commentCount
       FROM posts p
       ORDER BY p.created_at DESC
       LIMIT ? OFFSET ?`
    )
      .bind(limit, offset)
      .all();

    const posts = (result.results || []).map((row) => ({
      id: row.id,
      title: row.title,
      createdAt: row.created_at,
      commentCount: row.commentCount || 0,
    }));

    return jsonResponse({
      posts,
      nextOffset: offset + posts.length,
      hasMore: posts.length === limit,
    });
  }

  if (request.method === 'POST') {
    const body = await parseJson(request);
    if (!body) return jsonResponse({ message: '잘못된 요청입니다.' }, 400);

    const title = validateText(body.title, MAX_TITLE);
    const content = validateText(body.content, MAX_CONTENT);
    const password = validateText(body.password, 20);

    if (!title || !content || !password || password.length < 4) {
      return jsonResponse({ message: '제목, 내용, 비밀번호를 확인해 주세요.' }, 400);
    }

    if (containsForbiddenContent(`${title} ${content}`)) {
      return jsonResponse({ message: '금칙어가 포함되어 등록할 수 없습니다.' }, 400);
    }

    const ipHash = await getIpHash(request, env.IP_PEPPER || '');
    const rateKey = `rate:post:${ipHash}`;
    const allowed = await checkRateLimit(env, rateKey, POST_COOLDOWN_SECONDS);
    if (!allowed) {
      return jsonResponse({ message: '너무 빠른 등록입니다. 잠시 후 다시 시도해 주세요.' }, 429);
    }

    const id = crypto.randomUUID();
    const now = Date.now();
    const passwordHash = await hashPassword(password, env.PASSWORD_PEPPER || '');

    await env.DB.prepare(
      'INSERT INTO posts (id, title, content, created_at, updated_at, password_hash) VALUES (?, ?, ?, ?, ?, ?)'
    )
      .bind(id, title, content, now, now, passwordHash)
      .run();

    return jsonResponse(
      {
        post: {
          id,
          title,
          content,
          createdAt: now,
          updatedAt: now,
          commentCount: 0,
        },
      },
      201
    );
  }

  return new Response('Method Not Allowed', { status: 405 });
}
