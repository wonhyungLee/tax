import { jsonResponse, requireEnv } from '../_lib/utils.js';

const encoder = new TextEncoder();

const CATEGORY_KEYWORDS = {
  card: ['카드지갑', '가계부', '영수증 정리'],
  insurance: ['서류 정리함', '파일 박스', '라벨기'],
  health: ['건강기록', '영양제', '헬스 케어'],
  education: ['스터디 플래너', '노트', '필기구'],
  housing: ['정리함', '수납 박스', '라벨기'],
  pension: ['재테크', '가계부', '가계 플래너'],
  donation: ['기부', '달력', '다이어리'],
  finance: ['가계부', '계산기', '서류 정리함'],
};

const EVENT_CURATION = [
  {
    id: 'year-end',
    name: '연말정산 서류 정리',
    months: [12, 1, 2],
    tagline: '영수증·증빙을 한 번에 정리',
    keywords: ['서류 정리함', '라벨기', '가계부', '파일 박스', '서류 파쇄기', '문서 스캐너'],
    cta: '증빙 정리템 보기',
  },
  {
    id: 'new-semester',
    name: '신학기·업무 리셋',
    months: [2, 3],
    tagline: '새 학기/분기 플래너와 문서 정리',
    keywords: ['플래너', '데스크 오거나이저', 'USB 백업', '문서 스캐너'],
    cta: '리셋 아이템 보기',
  },
  {
    id: 'family-month',
    name: '가정의 달 준비',
    months: [4, 5],
    tagline: '선물·사진·서류를 깔끔하게 보관',
    keywords: ['포토 프린터', '액자', '서랍 정리함', '선물 포장지'],
    cta: '선물·보관템 보기',
  },
  {
    id: 'summer-trip',
    name: '여름 휴가 준비',
    months: [6, 7, 8],
    tagline: '휴가 서류·소지품 정리 필수템',
    keywords: ['여행 파우치', '방수팩', '케이블 파우치', '캐리어 오거나이저'],
    cta: '휴가 준비물 보기',
  },
  {
    id: 'chuseok',
    name: '명절/추석 준비',
    months: [9, 10],
    tagline: '선물·택배 포장/보관 필수템',
    keywords: ['선물세트', '보자기', '택배 박스', '아이스박스'],
    cta: '명절 준비물 보기',
  },
  {
    id: 'sale-season',
    name: '11월 특가 시즌',
    months: [11],
    tagline: '블랙프라이데이/쿠폰 특가 한 번에',
    keywords: ['블랙프라이데이', '쿠폰 베스트', '특가 모음', '가전 특가', '생활 특가'],
    cta: '특가 확인하기',
  },
];

const DEFAULT_THEME = {
  id: 'always-on',
  name: '오늘의 추천',
  tagline: '서류·가계 정리에 바로 쓰는 베스트',
  keywords: CATEGORY_KEYWORDS.finance,
  cta: '바로 보기',
};

const getEventTheme = (now = new Date()) => {
  const month = now.getMonth() + 1;
  return EVENT_CURATION.find((event) => event.months.includes(month)) || DEFAULT_THEME;
};

const buildKeywordPool = (theme, category) => {
  const pool = [...(theme?.keywords || [])];
  if (CATEGORY_KEYWORDS[category]) {
    pool.push(...CATEGORY_KEYWORDS[category]);
  } else {
    pool.push(...CATEGORY_KEYWORDS.finance);
  }
  const unique = Array.from(new Set(pool.filter(Boolean)));
  return unique.length ? unique : ['가계부'];
};

const pickKeyword = (pool) => {
  return pool[Math.floor(Math.random() * pool.length)] || '가계부';
};

const formatPrice = (value) => {
  if (!Number.isFinite(value)) return '';
  return `${value.toLocaleString('ko-KR')}원`;
};

const CTA_VARIANTS = ['최저가 보기', '배송 일정 확인', '리뷰 보고 선택'];

const toHex = (buffer) =>
  Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

const getCoupangDate = () => {
  const now = new Date();
  const pad = (num) => String(num).padStart(2, '0');
  const year = String(now.getUTCFullYear()).slice(-2);
  return `${year}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(
    now.getUTCHours()
  )}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
};

const signRequest = async (secretKey, message) => {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secretKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return toHex(signature);
};

const fetchCoupangProducts = async (env, keyword, theme) => {
  const accessKey = requireEnv(env, 'COUPANG_ACCESS_KEY');
  const secretKey = requireEnv(env, 'COUPANG_SECRET_KEY');
  const subId = env.COUPANG_SUB_ID || 'tax-preview';

  const path = '/v2/providers/affiliate_open_api/apis/openapi/v1/products/search';
  const query = `keyword=${encodeURIComponent(keyword)}&limit=3&subId=${encodeURIComponent(subId)}`;
  const datetime = getCoupangDate();
  const message = `${datetime}GET${path}${query}`;
  const signature = await signRequest(secretKey, message);
  const authorization = `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${datetime}, signature=${signature}`;

  const response = await fetch(`https://api-gateway.coupang.com${path}?${query}`, {
    headers: {
      Authorization: authorization,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Coupang API error: ${response.status} ${text}`.trim());
  }

  const data = await response.json();
  if (data?.rCode && data.rCode !== '0') {
    throw new Error(data.rMessage || 'Coupang API error');
  }
  const products = data?.data?.productData || [];
  return products.map((product, index) => {
    const discount = Number(product.productDiscountRate);
    const rocket =
      product.rocketWow ||
      product.rocket ||
      product.rocketDeliveryType === 'ROCKET' ||
      product.isRocket ||
      product.isRocketWow;
    const freeShipping = product.isFreeShipping || product.freeShipping;
    const shippingTag = rocket ? '로켓배송' : freeShipping ? '무료배송' : '';
    const ratingCount = Number(product.ratingCount ?? product.reviewCount);
    const rating = Number(product.rating ?? product.ratingAverage ?? product.ratingScore);
    const metaParts = [];
    if (Number.isFinite(rating) && rating > 0) {
      metaParts.push(`★${rating.toFixed(1)}`);
    }
    if (Number.isFinite(ratingCount) && ratingCount > 0) {
      metaParts.push(`리뷰 ${ratingCount.toLocaleString('ko-KR')}개`);
    }
    if (shippingTag) metaParts.push(shippingTag);
    if (product.categoryName || product.sellerName || theme?.name) {
      metaParts.push(product.categoryName || product.sellerName || theme?.name || '');
    }

    return {
      title: product.productName,
      image: product.productImage,
      link: product.productUrl,
      price: formatPrice(product.productPrice),
      meta: metaParts.join(' · ') || '',
      badge: theme?.name || '',
      discountRate: Number.isFinite(discount) && discount > 0 ? Math.round(discount) : null,
      cta: theme?.cta || CTA_VARIANTS[index % CTA_VARIANTS.length],
      shippingTag,
      ratingCount: Number.isFinite(ratingCount) && ratingCount > 0 ? ratingCount : null,
      rating: Number.isFinite(rating) && rating > 0 ? rating : null,
    };
  });
};

const getTopCategory = async (env) => {
  const row = await env.DB.prepare(
    'SELECT category FROM ad_interest ORDER BY count DESC, updated_at DESC LIMIT 1'
  ).first();
  return row?.category || 'finance';
};

export async function onRequest({ request, env }) {
  try {
    if (!env.DB) {
      return jsonResponse({ message: 'DB 설정이 필요합니다.' }, 500);
    }

    if (request.method !== 'GET') {
      return jsonResponse({ message: 'Method Not Allowed' }, 405);
    }

    const theme = getEventTheme();
    const category = await getTopCategory(env);
    const keywordPool = buildKeywordPool(theme, category);
    const keyword = pickKeyword(keywordPool);
    const cacheKey = `banner:${theme.id}:${category || 'any'}`;
    if (env.APP_KV) {
      const cached = await env.APP_KV.get(cacheKey, 'json');
      if (cached?.items?.length) {
        return jsonResponse(cached);
      }
    }

    let items = [];
    try {
      items = await fetchCoupangProducts(env, keyword, theme);
    } catch (error) {
      items = [];
    }

    const payload = {
      category,
      keyword,
      theme: { id: theme.id, title: theme.name, tagline: theme.tagline, cta: theme.cta },
      items,
    };
    if (env.APP_KV) {
      const ttl = items.length ? 1800 : 120;
      await env.APP_KV.put(cacheKey, JSON.stringify(payload), { expirationTtl: ttl });
    }

    return jsonResponse(payload);
  } catch (error) {
    return jsonResponse({ message: '배너를 불러오지 못했습니다.' }, 500);
  }
}
