import { jsonResponse, requireEnv } from '../_lib/utils.js';
import { ensureBoardSchema } from '../_lib/schema.js';
import { getApiErrorMessage } from '../_lib/errors.js';

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

const pickKeyword = (category) => {
  const pool = CATEGORY_KEYWORDS[category] || CATEGORY_KEYWORDS.finance;
  return pool[Math.floor(Math.random() * pool.length)] || '가계부';
};

const MIN_PRICE = 500_000; // 50만원 이상 가전/고가 제품만 노출

const formatPrice = (value) => {
  if (!Number.isFinite(value)) return '';
  return `${value.toLocaleString('ko-KR')}원`;
};

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

const fetchCoupangProducts = async (env, keyword) => {
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
  const filtered = products.filter((product) => {
    const price = Number(product.productPrice) || 0;
    return price >= MIN_PRICE;
  });

  const chosen = filtered.length ? filtered : products;

  return chosen.map((product) => ({
    title: product.productName,
    image: product.productImage,
    link: product.productUrl,
    price: formatPrice(product.productPrice),
    meta: product.categoryName || product.sellerName || '',
  }));
};

const getTopCategory = async (env) => {
  try {
    await ensureBoardSchema(env.DB);
  } catch (error) {
    return 'finance';
  }
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

    const category = await getTopCategory(env);
    const cacheKey = `banner:${category}`;
    if (env.APP_KV) {
      const cached = await env.APP_KV.get(cacheKey, 'json');
      if (cached?.items?.length) {
        return jsonResponse(cached);
      }
    }

    let items = [];
    try {
      const keyword = pickKeyword(category);
      items = await fetchCoupangProducts(env, keyword);
    } catch (error) {
      items = [];
    }

    const payload = { category, items };
    if (env.APP_KV) {
      const ttl = items.length ? 1800 : 120;
      await env.APP_KV.put(cacheKey, JSON.stringify(payload), { expirationTtl: ttl });
    }

    return jsonResponse(payload);
  } catch (error) {
    return jsonResponse({ message: getApiErrorMessage(error, request) }, 500);
  }
}
