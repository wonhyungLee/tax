const normalizeMessage = (error) => {
  if (!error) return '';
  if (error instanceof Error) return error.message || '';
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch (err) {
    return String(error);
  }
};

export const getApiErrorMessage = (error, request) => {
  const message = normalizeMessage(error);
  if (!message) return '서버 오류가 발생했습니다.';

  const lower = message.toLowerCase();
  if (lower.includes('read only') || lower.includes('readonly')) {
    return 'DB가 읽기 전용입니다. Cloudflare D1 바인딩을 읽기/쓰기 모드로 바꿔 주세요.';
  }
  if (lower.includes('no such table') || lower.includes('no such column')) {
    return '게시판 DB 스키마가 최신이 아닙니다. schema.sql을 다시 적용해 주세요.';
  }
  if (lower.includes('d1_error') || lower.includes('sqlite')) {
    return 'DB 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
  }

  const url = request ? new URL(request.url) : null;
  if (url?.searchParams.get('debug') === '1') {
    return message;
  }

  return '서버 오류가 발생했습니다.';
};
