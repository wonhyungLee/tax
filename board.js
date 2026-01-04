const postForm = document.getElementById('post-form');
const postTitle = document.getElementById('post-title');
const postContent = document.getElementById('post-content');
const postPassword = document.getElementById('post-password');
const postFormStatus = document.getElementById('post-form-status');
const postList = document.getElementById('post-list');
const refreshPostsButton = document.getElementById('refresh-posts');
const loadMoreButton = document.getElementById('load-more');
const postDetail = document.getElementById('post-detail');
const postBody = document.getElementById('post-body');
const postEditButton = document.getElementById('post-edit');
const postDeleteButton = document.getElementById('post-delete');
const commentList = document.getElementById('comment-list');
const commentForm = document.getElementById('comment-form');
const commentContent = document.getElementById('comment-content');
const commentPassword = document.getElementById('comment-password');
const commentStatus = document.getElementById('comment-form-status');

let posts = [];
let offset = 0;
let hasMore = true;
let selectedPost = null;
let isLoading = false;

const formatDate = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const escapeText = (value) => {
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
};

const setStatus = (el, message, isError = false) => {
  if (!el) return;
  el.textContent = message;
  el.style.color = isError ? '#9b2c1f' : '#6c7a90';
};

const parseResponse = async (response) => {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      return await response.json();
    } catch (error) {
      return {};
    }
  }
  const text = await response.text();
  if (!text) return {};
  if (text.trim().startsWith('<')) {
    return { message: '서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' };
  }
  return { message: text };
};

const getErrorMessage = (response, data, fallback) => {
  if (data?.message) return data.message;
  if (fallback) return fallback;
  return `요청에 실패했습니다. (${response.status})`;
};

const renderPostList = () => {
  if (!postList) return;
  if (!posts.length) {
    postList.innerHTML = '<div class="list-empty">아직 등록된 게시글이 없습니다.</div>';
    return;
  }
  postList.innerHTML = posts
    .map((post) => {
      const activeClass = selectedPost && selectedPost.id === post.id ? 'post-item active' : 'post-item';
      return `
        <div class="${activeClass}" data-id="${post.id}">
          <div class="post-title">${escapeText(post.title)}</div>
          <div class="post-meta">${formatDate(post.createdAt)} · 댓글 ${post.commentCount || 0}</div>
        </div>
      `;
    })
    .join('');
};

const renderPostDetail = (post) => {
  if (!postBody) return;
  if (!post) {
    postBody.innerHTML = '<p class="mini">게시글을 선택하면 내용이 표시됩니다.</p>';
    commentList.innerHTML = '';
    return;
  }
  postBody.innerHTML = `
    <div class="post-title">${escapeText(post.title)}</div>
    <div class="post-meta">${formatDate(post.createdAt)}${post.updatedAt ? ` (수정 ${formatDate(post.updatedAt)})` : ''}</div>
    <div class="post-body">${escapeText(post.content).replace(/\n/g, '<br />')}</div>
  `;
  renderComments(post.comments || []);
};

const renderComments = (comments) => {
  if (!commentList) return;
  if (!comments.length) {
    commentList.innerHTML = '<div class="mini">아직 댓글이 없습니다.</div>';
    return;
  }
  commentList.innerHTML = comments
    .map((comment) => {
      return `
        <div class="comment-item" data-id="${comment.id}">
          <div>${escapeText(comment.content).replace(/\n/g, '<br />')}</div>
          <div class="comment-meta">${formatDate(comment.createdAt)}</div>
          <div class="inline-actions">
            <button type="button" class="btn ghost" data-action="comment-edit">수정</button>
            <button type="button" class="btn danger" data-action="comment-delete">삭제</button>
          </div>
        </div>
      `;
    })
    .join('');
};

const fetchPosts = async ({ reset = false } = {}) => {
  if (isLoading) return;
  isLoading = true;
  try {
    if (reset) {
      offset = 0;
      hasMore = true;
    }
    const response = await fetch(`/api/posts?offset=${offset}&limit=10`);
    const data = await parseResponse(response);
    if (!response.ok) throw new Error(getErrorMessage(response, data, '게시글을 불러오지 못했습니다.'));
    if (!Array.isArray(data.posts)) throw new Error('게시글 응답이 올바르지 않습니다.');
    const incoming = data.posts || [];
    if (reset) {
      posts = incoming;
    } else {
      posts = posts.concat(incoming);
    }
    offset = data.nextOffset ?? posts.length;
    hasMore = data.hasMore ?? incoming.length === 10;
    renderPostList();
    if (loadMoreButton) {
      loadMoreButton.style.display = hasMore ? 'block' : 'none';
    }
  } catch (error) {
    if (postList) {
      postList.innerHTML = `<div class="list-empty">${error.message}</div>`;
    }
  } finally {
    isLoading = false;
  }
};

const fetchPostDetail = async (id) => {
  if (!id) return;
  try {
    const response = await fetch(`/api/posts/${id}`);
    const data = await parseResponse(response);
    if (!response.ok) throw new Error(getErrorMessage(response, data, '게시글을 불러오지 못했습니다.'));
    selectedPost = data.post;
    renderPostList();
    renderPostDetail(selectedPost);
  } catch (error) {
    setStatus(postFormStatus, error.message, true);
  }
};

const submitPost = async (event) => {
  event.preventDefault();
  if (!postTitle.value.trim() || !postContent.value.trim() || !postPassword.value.trim()) {
    setStatus(postFormStatus, '제목, 내용, 비밀번호를 입력해 주세요.', true);
    return;
  }
  try {
    setStatus(postFormStatus, '등록 중...');
    const response = await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: postTitle.value.trim(),
        content: postContent.value.trim(),
        password: postPassword.value.trim(),
      }),
    });
    const data = await parseResponse(response);
    if (!response.ok) throw new Error(getErrorMessage(response, data, '등록에 실패했습니다.'));
    setStatus(postFormStatus, '등록 완료');
    postTitle.value = '';
    postContent.value = '';
    postPassword.value = '';
    await fetchPosts({ reset: true });
    if (data.post?.id) {
      fetchPostDetail(data.post.id);
    }
  } catch (error) {
    setStatus(postFormStatus, error.message, true);
  }
};

const editPost = async () => {
  if (!selectedPost) {
    setStatus(postFormStatus, '수정할 게시글을 선택하세요.', true);
    return;
  }
  const newTitle = prompt('수정할 제목을 입력하세요.', selectedPost.title);
  if (newTitle === null) return;
  const newContent = prompt('수정할 내용을 입력하세요.', selectedPost.content);
  if (newContent === null) return;
  const password = prompt('비밀번호를 입력하세요.');
  if (!password) return;

  try {
    const response = await fetch(`/api/posts/${selectedPost.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle.trim(), content: newContent.trim(), password: password.trim() }),
    });
    const data = await parseResponse(response);
    if (!response.ok) throw new Error(getErrorMessage(response, data, '수정 실패'));
    selectedPost = data.post;
    renderPostList();
    renderPostDetail(selectedPost);
  } catch (error) {
    setStatus(postFormStatus, error.message, true);
  }
};

const deletePost = async () => {
  if (!selectedPost) {
    setStatus(postFormStatus, '삭제할 게시글을 선택하세요.', true);
    return;
  }
  const password = prompt('비밀번호를 입력하세요.');
  if (!password) return;
  if (!confirm('정말 삭제하시겠습니까?')) return;

  try {
    const response = await fetch(`/api/posts/${selectedPost.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: password.trim() }),
    });
    const data = await parseResponse(response);
    if (!response.ok) throw new Error(getErrorMessage(response, data, '삭제 실패'));
    selectedPost = null;
    await fetchPosts({ reset: true });
    renderPostDetail(null);
  } catch (error) {
    setStatus(postFormStatus, error.message, true);
  }
};

const submitComment = async (event) => {
  event.preventDefault();
  if (!selectedPost) {
    setStatus(commentStatus, '먼저 게시글을 선택하세요.', true);
    return;
  }
  if (!commentContent.value.trim() || !commentPassword.value.trim()) {
    setStatus(commentStatus, '댓글 내용과 비밀번호를 입력하세요.', true);
    return;
  }
  try {
    setStatus(commentStatus, '등록 중...');
    const response = await fetch(`/api/posts/${selectedPost.id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: commentContent.value.trim(),
        password: commentPassword.value.trim(),
      }),
    });
    const data = await parseResponse(response);
    if (!response.ok) throw new Error(getErrorMessage(response, data, '댓글 등록 실패'));
    commentContent.value = '';
    commentPassword.value = '';
    setStatus(commentStatus, '댓글 등록 완료');
    selectedPost = data.post;
    renderPostList();
    renderPostDetail(selectedPost);
  } catch (error) {
    setStatus(commentStatus, error.message, true);
  }
};

const editComment = async (id) => {
  if (!selectedPost) return;
  const target = selectedPost.comments.find((comment) => comment.id === id);
  if (!target) return;
  const newContent = prompt('수정할 댓글 내용을 입력하세요.', target.content);
  if (newContent === null) return;
  const password = prompt('비밀번호를 입력하세요.');
  if (!password) return;

  try {
    const response = await fetch(`/api/comments/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: newContent.trim(), password: password.trim() }),
    });
    const data = await parseResponse(response);
    if (!response.ok) throw new Error(getErrorMessage(response, data, '댓글 수정 실패'));
    selectedPost = data.post;
    renderPostList();
    renderPostDetail(selectedPost);
  } catch (error) {
    setStatus(commentStatus, error.message, true);
  }
};

const deleteComment = async (id) => {
  if (!selectedPost) return;
  const password = prompt('비밀번호를 입력하세요.');
  if (!password) return;
  if (!confirm('댓글을 삭제하시겠습니까?')) return;

  try {
    const response = await fetch(`/api/comments/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: password.trim() }),
    });
    const data = await parseResponse(response);
    if (!response.ok) throw new Error(getErrorMessage(response, data, '댓글 삭제 실패'));
    selectedPost = data.post;
    renderPostList();
    renderPostDetail(selectedPost);
  } catch (error) {
    setStatus(commentStatus, error.message, true);
  }
};

postList.addEventListener('click', (event) => {
  const item = event.target.closest('.post-item');
  if (!item) return;
  const id = item.dataset.id;
  if (id) fetchPostDetail(id);
});

commentList.addEventListener('click', (event) => {
  const action = event.target.dataset.action;
  const item = event.target.closest('.comment-item');
  if (!action || !item) return;
  const id = item.dataset.id;
  if (action === 'comment-edit') editComment(id);
  if (action === 'comment-delete') deleteComment(id);
});

postForm.addEventListener('submit', submitPost);
commentForm.addEventListener('submit', submitComment);
refreshPostsButton.addEventListener('click', () => fetchPosts({ reset: true }));
loadMoreButton.addEventListener('click', () => {
  if (hasMore) fetchPosts();
});
postEditButton.addEventListener('click', editPost);
postDeleteButton.addEventListener('click', deletePost);

fetchPosts({ reset: true });
