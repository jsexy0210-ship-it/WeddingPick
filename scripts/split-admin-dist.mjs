#!/usr/bin/env node
/**
 * 관리자 콘솔 출처 분리 — 배포 산출물을 역할에 맞게 깎는다.
 *
 *   node scripts/split-admin-dist.mjs app     (weddingpick-app-web 가 쓴다)
 *   node scripts/split-admin-dist.mjs admin   (weddingpick-admin 이 쓴다)
 *
 * **왜 render.yaml의 `routes`가 아니라 이 스크립트인가.**
 * 두 가지 이유다.
 *
 *   1. 이 저장소의 Blueprint sync가 깨져 있다(render.yaml 머리말, 2026-09-07).
 *      `render.yaml`에 적은 `routes`가 Render에 반영된다는 보장이 없다 —
 *      지금 그 파일은 사실상 문서다.
 *   2. Render 정적 사이트에서 route 규칙과 실재하는 파일 중 무엇이 이기는지
 *      확인하지 못했다. 추측 위에 경계를 세우지 않는다.
 *
 * 파일이 없으면 규칙 해석과 무관하게 없다. 그래서 산출물을 직접 깎는다.
 *
 * **이 분리로 얻는 것은 출처 분리 하나다.** 관리자 토큰이 사용자 앱과 다른
 * localStorage에 들어가고, 사용자 화면 쪽 XSS가 관리자 토큰에 닿지 못한다.
 * 얻지 못하는 것은 docs/admin-origin-split.md에 적어 두었다 — 정적 사이트라
 * 앞단 인증도 IP 제한도 걸 수 없고, 화면 코드는 주소를 알면 누구나 받는다.
 * 지켜야 할 것은 화면이 아니라 정보이고, 그건 API가 토큰으로 막는다.
 */

import { existsSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'apps', 'mobile', 'dist');

/*
 * 관리자 출처. 기본값은 운영 주소이고, 스테이징처럼 다른 곳에 올릴 때만
 * 환경변수로 덮는다. 비밀이 아니다 — 브라우저 주소창에 그대로 보이는 값이다.
 */
const ADMIN_ORIGIN = (process.env.ADMIN_ORIGIN || 'https://weddingpick-admin.onrender.com').replace(/\/+$/, '');

/*
 * 관리자 출처에 남길 것. 이 목록에 없는 최상위 항목은 지운다.
 *
 * 화이트리스트로 적는 이유 — 사용자 화면 라우트는 계속 늘어난다. 지울 것을
 * 세어두면 새 라우트가 생길 때마다 여기를 고쳐야 하고, 빠뜨리면 사용자 화면이
 * 관리자 출처에 조용히 남는다. 남길 것만 세어두면 그런 일이 없다.
 */
const ADMIN_KEEP = new Set([
  'admin', // 관리자 화면 33개
  '_expo', // JS·CSS 번들 (사용자 화면과 같은 번들 하나다 — 갈라지지 않는다)
  'assets', // 폰트·이미지
  'favicon.ico',
  '+not-found.html',
]);

/** 사람이 볼 일이 거의 없는 화면이다 — 브라우저가 곧바로 넘긴다. */
function redirectStub(target, label) {
  /*
   * meta refresh와 스크립트를 함께 둔다. 스크립트가 막힌 환경에서도 meta가
   * 넘기고, 스크립트가 도는 환경에서는 물음표 뒤와 # 뒤를 잃지 않는다.
   * canonical은 검색 엔진이 옛 주소를 붙들지 않게 한다.
   */
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex">
<meta http-equiv="refresh" content="0; url=${target}">
<link rel="canonical" href="${target}">
<title>${label}</title>
<script>
location.replace(${JSON.stringify(target)} + location.search + location.hash);
</script>
</head>
<body>
<p>${label} — <a href="${target}">${target}</a></p>
</body>
</html>
`;
}

/** dist 아래 .html을 전부 모은다. */
function htmlFilesUnder(dir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...htmlFilesUnder(full));
    else if (entry.endsWith('.html')) found.push(full);
  }
  return found;
}

/**
 * 앱 출처: 관리자 화면을 관리자 출처로 넘긴다.
 *
 * 지우지 않고 넘기는 이유 — 지우기만 하면 `/*` → `/index.html` 폴백에 걸려
 * SPA가 뜨고, 클라이언트 라우터가 같은 관리자 화면을 그려버린다. 관리자가
 * 두 곳에 살아 있는 상태가 그대로 남는다. 넘겨야 실제로 한 곳이 된다.
 */
function pruneForApp() {
  const adminDir = join(DIST, 'admin');
  if (!existsSync(adminDir)) {
    console.error('!! dist/admin이 없다 — export가 돌지 않았거나 라우트가 사라졌다.');
    process.exit(1);
  }

  const pages = htmlFilesUnder(adminDir);
  for (const page of pages) {
    const route = relative(DIST, page).replace(/\.html$/, '').split('\\').join('/');
    writeFileSync(page, redirectStub(`${ADMIN_ORIGIN}/${route}`, '관리자 콘솔 주소가 바뀌었어요'));
  }

  console.log(`app: 관리자 화면 ${pages.length}장을 ${ADMIN_ORIGIN} 로 넘기게 바꿨다.`);
}

/**
 * 관리자 출처: 사용자 화면을 치운다.
 *
 * **이건 정리이지 보안 경계가 아니다.** 번들 하나를 두 출처가 함께 쓰므로
 * 사용자 라우트 코드는 관리자 출처에도 남아 있고, 클라이언트 라우팅으로는
 * 그려질 수 있다. 실제 경계는 출처 하나뿐이다.
 */
function pruneForAdmin() {
  const adminDir = join(DIST, 'admin');
  if (!existsSync(adminDir)) {
    console.error('!! dist/admin이 없다 — export가 돌지 않았거나 라우트가 사라졌다.');
    process.exit(1);
  }

  let removed = 0;
  for (const entry of readdirSync(DIST)) {
    if (ADMIN_KEEP.has(entry)) continue;
    rmSync(join(DIST, entry), { recursive: true, force: true });
    removed += 1;
  }

  /*
   * 관리자 출처의 첫 화면. 여기서 `/admin/home`으로 넘긴다.
   *
   * `/admin` 접두어를 관리자 출처에서도 그대로 두는 이유 — expo-router의
   * static 출력은 URL 경로로 라우트를 찾는다. `/admin/home`을 `/home`으로
   * 바꿔 내보내면 서버가 보낸 HTML과 클라이언트 라우터가 어긋난다. 덤으로
   * `_api.ts`의 `/admin/login` 리다이렉트(PR #167)도 고칠 것이 없어진다.
   */
  writeFileSync(join(DIST, 'index.html'), redirectStub('/admin/home', '관리자 콘솔'));

  console.log(`admin: 사용자 화면 ${removed}개 항목을 치우고 index.html을 /admin/home으로 걸었다.`);
}

const role = process.argv[2];
if (role === 'app') pruneForApp();
else if (role === 'admin') pruneForAdmin();
else {
  console.error('쓰임: node scripts/split-admin-dist.mjs <app|admin>');
  process.exit(1);
}
