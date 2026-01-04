import { jsonResponse, parseJson, hashPassword } from '../../../_lib/utils.js';
import { containsForbiddenContent } from '../../../_lib/filter.js';
import { MAX_TITLE, MAX_CONTENT, validateText, getPostWithComments } from '../../../_lib/board.js';

export async function onRequest({ request, env, params }) {
  if (!env.DB) {
    return jsonResponse({ message: 'DB 설정이 필요합니다.' }, 500);
  }

  const id = params.id;
  if (!id) return jsonResponse({ message: '게시글 ID가 필요합니다.' }, 400);

  if (request.method === 'GET') {
    const post = await getPostWithComments(env.DB, id);
    if (!post) return jsonResponse({ message: '게시글을 찾을 수 없습니다.' }, 404);
    post.commentCount = post.comments.length;
    return jsonResponse({ post });
  }

  if (request.method === 'PUT') {
    const body = await parseJson(request);
    if (!body) return jsonResponse({ message: '잘못된 요청입니다.' }, 400);

    const title = validateText(body.title, MAX_TITLE);
    const content = validateText(body.content, MAX_CONTENT);
    const password = validateText(body.password, 20);

    if (!title || !content || !password || password.length < 4) {
      return jsonResponse({ message: '제목, 내용, 비밀번호를 확인해 주세요.' }, 400);
    }

    if (containsForbiddenContent(`${title} ${content}`)) {
      return jsonResponse({ message: '금칙어가 포함되어 수정할 수 없습니다.' }, 400);
    }

    const record = await env.DB.prepare('SELECT password_hash FROM posts WHERE id = ?')
      .bind(id)
      .first();
    if (!record) return jsonResponse({ message: '게시글을 찾을 수 없습니다.' }, 404);

    const passwordHash = await hashPassword(password, env.PASSWORD_PEPPER || '');
    if (passwordHash !== record.password_hash) {
      return jsonResponse({ message: '비밀번호가 일치하지 않습니다.' }, 403);
    }

    const now = Date.now();
    await env.DB.prepare('UPDATE posts SET title = ?, content = ?, updated_at = ? WHERE id = ?')
      .bind(title, content, now, id)
      .run();

    const post = await getPostWithComments(env.DB, id);
    return jsonResponse({ post });
  }

  if (request.method === 'DELETE') {
    const body = await parseJson(request);
    if (!body) return jsonResponse({ message: '잘못된 요청입니다.' }, 400);
    const password = validateText(body.password, 20);
    if (!password) return jsonResponse({ message: '비밀번호를 입력해 주세요.' }, 400);

    const record = await env.DB.prepare('SELECT password_hash FROM posts WHERE id = ?')
      .bind(id)
      .first();
    if (!record) return jsonResponse({ message: '게시글을 찾을 수 없습니다.' }, 404);

    const passwordHash = await hashPassword(password, env.PASSWORD_PEPPER || '');
    if (passwordHash !== record.password_hash) {
      return jsonResponse({ message: '비밀번호가 일치하지 않습니다.' }, 403);
    }

    await env.DB.prepare('DELETE FROM comments WHERE post_id = ?').bind(id).run();
    await env.DB.prepare('DELETE FROM posts WHERE id = ?').bind(id).run();

    return jsonResponse({ success: true });
  }

  return new Response('Method Not Allowed', { status: 405 });
}
