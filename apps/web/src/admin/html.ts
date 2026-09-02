/**
 * 아주 작은 HTML 조립 도구.
 *
 * 이 워크스페이스의 원칙(`apps/web/README.md`) — 프레임워크도 클라이언트
 * 자바스크립트도 없다 — 을 관리자 화면에도 그대로 잇는다. 다른 점은 이 서버는
 * 요청마다 DB를 읽어 새로 그린다는 것뿐이다.
 *
 * DB에서 읽은 값(운영자 스스로 적어 넣은 것이라도)은 전부 `escapeHtml`을
 * 거친다 — 관리자 화면이라고 덜 조심할 이유가 없다.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const NAV: readonly { path: string; label: string }[] = [
  { path: '/', label: '홈' },
  { path: '/briefing', label: '일일 브리핑' },
  { path: '/automation', label: '자동화 상태' },
  { path: '/audit-log', label: '감사 로그' },
  { path: '/users', label: '사용자' },
];

export function renderPage(input: { title: string; activePath: string; body: string }): string {
  const nav = NAV.map(
    (item) =>
      `<a href="${item.path}" class="nav-link${item.path === input.activePath ? ' active' : ''}">${escapeHtml(item.label)}</a>`
  ).join('');

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${escapeHtml(input.title)} · 웨딩픽 관리자</title>
<style>${STYLES}</style>
</head>
<body>
<header class="topbar">
  <span class="brand">웨딩픽 관리자</span>
  <nav>${nav}</nav>
</header>
<main>${input.body}</main>
</body>
</html>`;
}

const STYLES = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Pretendard Variable', 'Apple SD Gothic Neo',
      'Noto Sans KR', sans-serif;
    color: #212124;
    background: #f7f8fa;
  }
  .topbar {
    display: flex;
    align-items: center;
    gap: 24px;
    padding: 12px 24px;
    background: #ffffff;
    border-bottom: 1px solid #eaebee;
  }
  .brand { font-weight: 700; color: #ff6f61; }
  nav { display: flex; gap: 16px; flex-wrap: wrap; }
  .nav-link { color: #4d5159; text-decoration: none; font-size: 14px; }
  .nav-link:hover { color: #212124; }
  .nav-link.active { color: #ff6f61; font-weight: 600; }
  main { max-width: 960px; margin: 0 auto; padding: 24px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .subtitle { color: #4d5159; margin: 0 0 24px; font-size: 14px; }
  section { margin-bottom: 32px; }
  h2 { font-size: 16px; margin: 0 0 12px; }
  table { width: 100%; border-collapse: collapse; background: #ffffff; border-radius: 10px; overflow: hidden; }
  th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid #eaebee; font-size: 14px; }
  th { background: #f2f3f6; color: #4d5159; font-weight: 600; }
  tr:last-child td { border-bottom: none; }
  .empty { padding: 16px; color: #868b94; font-size: 14px; background: #ffffff; border-radius: 10px; }
  .card-row { display: flex; gap: 16px; flex-wrap: wrap; }
  .card {
    flex: 1;
    min-width: 160px;
    background: #ffffff;
    border-radius: 10px;
    padding: 16px;
  }
  .card .label { font-size: 13px; color: #868b94; }
  .card .value { font-size: 28px; font-weight: 700; margin-top: 4px; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 12px; background: #f2f3f6; }
  .badge.warn { background: #fff5e0; color: #b57a00; }
  .badge.bad { background: #ffe8e6; color: #e03131; }
  code { font-family: ui-monospace, monospace; font-size: 13px; }
`;
