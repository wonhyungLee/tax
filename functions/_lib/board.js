export const MAX_TITLE = 80;
export const MAX_CONTENT = 2000;

export const normalizeText = (value) => (typeof value === 'string' ? value.trim() : '');

export const validateText = (value, maxLength) => {
  const text = normalizeText(value);
  if (!text) return null;
  return text.length <= maxLength ? text : null;
};

export const getPostWithComments = async (db, id) => {
  const post = await db
    .prepare('SELECT id, title, content, created_at, updated_at FROM posts WHERE id = ?')
    .bind(id)
    .first();
  if (!post) return null;
  const commentRows = await db
    .prepare('SELECT id, content, created_at, updated_at FROM comments WHERE post_id = ? ORDER BY created_at ASC')
    .bind(id)
    .all();
  return {
    id: post.id,
    title: post.title,
    content: post.content,
    createdAt: post.created_at,
    updatedAt: post.updated_at || null,
    comments: (commentRows.results || []).map((row) => ({
      id: row.id,
      content: row.content,
      createdAt: row.created_at,
      updatedAt: row.updated_at || null,
    })),
  };
};
