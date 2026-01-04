import { jsonResponse, parseJson, hashPassword } from '../../_lib/utils.js';
import { containsForbiddenContent } from '../../_lib/filter.js';
import { MAX_CONTENT, validateText, getPostWithComments } from '../../_lib/board.js';

export async function onRequest({ request, env, params }) {
  try {
    if (!env.DB) {
      return jsonResponse({ message: 'DB 설정이 필요합니다.' }, 500);
    }

    const id = params.id;
    if (!id) return jsonResponse({ message: '댓글 ID가 필요합니다.' }, 400);

    const record = await env.DB.prepare('SELECT post_id, password_hash FROM comments WHERE id = ?')
      .bind(id)
      .first();
    if (!record) return jsonResponse({ message: '댓글을 찾을 수 없습니다.' }, 404);

    const body = await parseJson(request);
    if (!body) return jsonResponse({ message: '잘못된 요청입니다.' }, 400);
    const password = validateText(body.password, 20);
    if (!password) return jsonResponse({ message: '비밀번호를 입력해 주세요.' }, 400);

    const passwordHash = await hashPassword(password, env.PASSWORD_PEPPER || '');
    if (passwordHash !== record.password_hash) {
      return jsonResponse({ message: '비밀번호가 일치하지 않습니다.' }, 403);
    }

    if (request.method === 'PUT') {
      const content = validateText(body.content, MAX_CONTENT);
      if (!content) {
        return jsonResponse({ message: '댓글 내용을 입력해 주세요.' }, 400);
      }
      if (containsForbiddenContent(content)) {
        return jsonResponse({ message: '금칙어가 포함되어 수정할 수 없습니다.' }, 400);
      }
      const now = Date.now();
      await env.DB.prepare('UPDATE comments SET content = ?, updated_at = ? WHERE id = ?')
        .bind(content, now, id)
        .run();
      const post = await getPostWithComments(env.DB, record.post_id);
      return jsonResponse({ post });
    }

    if (request.method === 'DELETE') {
      await env.DB.prepare('DELETE FROM comments WHERE id = ?').bind(id).run();
      const post = await getPostWithComments(env.DB, record.post_id);
      return jsonResponse({ post });
    }

    return jsonResponse({ message: 'Method Not Allowed' }, 405);
  } catch (error) {
    return jsonResponse({ message: '서버 오류가 발생했습니다.' }, 500);
  }
}
