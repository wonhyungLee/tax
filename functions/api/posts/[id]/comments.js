import { jsonResponse, parseJson, hashPassword, getIpHash, checkRateLimit } from '../../../_lib/utils.js';
import { containsForbiddenContent } from '../../../_lib/filter.js';
import { MAX_CONTENT, validateText, getPostWithComments } from '../../../_lib/board.js';
import { ensureBoardSchema } from '../../../_lib/schema.js';
import { getApiErrorMessage } from '../../../_lib/errors.js';

const COMMENT_COOLDOWN_SECONDS = 6;

export async function onRequest({ request, env, params }) {
  try {
    if (!env.DB) {
      return jsonResponse({ message: 'DB 설정이 필요합니다.' }, 500);
    }

    if (request.method !== 'POST') {
      return jsonResponse({ message: 'Method Not Allowed' }, 405);
    }

    const id = params.id;
    if (!id) return jsonResponse({ message: '게시글 ID가 필요합니다.' }, 400);

    try {
      await ensureBoardSchema(env.DB);
    } catch (error) {
      return jsonResponse({ message: '게시판 DB 스키마가 최신이 아닙니다. schema.sql을 다시 적용해 주세요.' }, 500);
    }

    const body = await parseJson(request);
    if (!body) return jsonResponse({ message: '잘못된 요청입니다.' }, 400);

    const content = validateText(body.content, MAX_CONTENT);
    const password = validateText(body.password, 20);
    if (!content || !password || password.length < 4) {
      return jsonResponse({ message: '댓글 내용과 비밀번호를 확인해 주세요.' }, 400);
    }

    if (containsForbiddenContent(content)) {
      return jsonResponse({ message: '금칙어가 포함되어 등록할 수 없습니다.' }, 400);
    }

    const ipHash = await getIpHash(request, env.IP_PEPPER || '');
    const rateKey = `rate:comment:${ipHash}`;
    const allowed = await checkRateLimit(env, rateKey, COMMENT_COOLDOWN_SECONDS);
    if (!allowed) {
      return jsonResponse({ message: '너무 빠른 등록입니다. 잠시 후 다시 시도해 주세요.' }, 429);
    }

    const post = await env.DB.prepare('SELECT id FROM posts WHERE id = ?').bind(id).first();
    if (!post) return jsonResponse({ message: '게시글을 찾을 수 없습니다.' }, 404);

    const commentId = crypto.randomUUID();
    const now = Date.now();
    const passwordHash = await hashPassword(password, env.PASSWORD_PEPPER || '');

    await env.DB.prepare(
      'INSERT INTO comments (id, post_id, content, created_at, updated_at, password_hash) VALUES (?, ?, ?, ?, ?, ?)'
    )
      .bind(commentId, id, content, now, now, passwordHash)
      .run();

    const updated = await getPostWithComments(env.DB, id);
    return jsonResponse({ post: updated }, 201);
  } catch (error) {
    return jsonResponse({ message: getApiErrorMessage(error, request) }, 500);
  }
}
