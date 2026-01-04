const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const buildMeta = ({ title, description, url, image }) => {
  return `\n    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(url)}" />
    <meta property="og:type" content="website" />
    <meta property="og:image" content="${escapeHtml(image)}" />
    <meta property="og:image:width" content="1536" />
    <meta property="og:image:height" content="1024" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="robots" content="noindex" />\n`;
};

export async function onRequest({ request, env, params }) {
  const id = params.id;
  const origin = new URL(request.url).origin;
  const shareUrl = `${origin}/share/${id}`;
  const imageUrl = `${origin}/assets/hero-tax.png`;

  let title = '공유 기간 만료';
  let description = '공유 링크가 만료되었거나 존재하지 않습니다.';

  if (env.APP_KV && id) {
    const raw = await env.APP_KV.get(`share:${id}`);
    if (raw) {
      try {
        const payload = JSON.parse(raw);
        if (payload.label) {
          title = payload.label;
        } else if (payload.amount !== undefined) {
          const labelPrefix = payload.direction === 'payment' ? '추가 납부액' : '예상 환급액';
          title = `${labelPrefix} ${Number(payload.amount).toLocaleString('ko-KR')}원`;
        }
        description = '연말정산 미리보기 결과를 공유했습니다. 실제 결과는 제출 자료에 따라 달라질 수 있습니다.';
      } catch (error) {
        // Ignore JSON errors and use fallback text.
      }
    }
  }

  const metaTags = buildMeta({ title, description, url: shareUrl, image: imageUrl });
  const assetResponse = await env.ASSETS.fetch(new URL('/', request.url));
  const html = await assetResponse.text();
  const patched = html.replace('</head>', `${metaTags}</head>`);

  return new Response(patched, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
