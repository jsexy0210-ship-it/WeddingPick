import { socialMeta } from './social-meta';
/**
 * 두 화면이 함께 쓰는 겉껍데기 — 문서 틀, GNB, Footer.
 *
 * 홈과 업체 상세가 각자 GNB를 그리면 한쪽만 고쳐진다. 실제로 앱에서 그런 일이
 * 있었고(`관심업체`·`후보`·`찜`이 한 앱에 같이 있었다), 그래서 여기 한 벌만 둔다.
 */

import { POLICY_DOCUMENTS, TERMS } from '@weddingpick/domain';

import { escapeHtml } from './page';
import { FOOTER_BOTTOM, GNB_MENU, SITE } from './site-content';
import { SITE_STYLES } from './site-styles';

/**
 * 웨딩픽 심볼 — **하트 윤곽선 안에 체크.** 확정된 마크다.
 *
 * 경로는 `packages/ui/src/wedding-mark.tsx`의 값을 그대로 옮겼다. 그 파일은
 * react-native-svg를 불러오므로 node에서 도는 이 빌드가 import할 수 없다.
 * 옮겨 적은 값은 갈라지므로 `site.test.ts`가 두 곳이 같은지 지킨다 —
 * `styles.ts`가 theme.ts의 색을 옮겨 적고 시험으로 지키는 것과 같은 규칙이다.
 *
 * 24칸 격자다 — `spec/tokens.json`의 `symbol`이 정한 확정본 좌표다. 랜딩(v4)과
 * 서브페이지도 같은 값을 쓴다.
 */
const MARK_VIEWBOX = 24;
const MARK_HEART_PATH =
  'M12 20.5S3.5 15.2 3.5 9.9A4.4 4.4 0 0 1 12 8.1a4.4 4.4 0 0 1 8.5 1.8c0 5.3-8.5 10.6-8.5 10.6Z';
const MARK_CHECK_PATH = 'M8.7 11.9l2.2 2.2 4.4-4.4';
const MARK_STROKE = 1.9;

/**
 * 마크. 색은 `currentColor`로 받는다 — 코랄 바탕에 얹는 날 흰색으로 뒤집을 수
 * 있어야 하고, 그때 이 파일을 고치지 않는다.
 */
export function mark(size: number): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${MARK_VIEWBOX} ${MARK_VIEWBOX}" fill="none" aria-hidden="true" focusable="false">
      <path d="${MARK_HEART_PATH}" stroke="currentColor" stroke-width="${MARK_STROKE}" stroke-linecap="round" stroke-linejoin="round"></path>
      <path d="${MARK_CHECK_PATH}" stroke="currentColor" stroke-width="${MARK_STROKE}" stroke-linecap="round" stroke-linejoin="round"></path>
    </svg>`;
}

/** 소개 한 장이 나가는 자리. `build.ts`가 이 이름으로 쓴다. */
const LANDING_PATH = '/about.html';

function gnb(current: string | null): string {
  const menu = GNB_MENU.map((item) => {
    const label = escapeHtml(item.label);

    /* 화면이 없는 자리는 링크로 만들지 않는다. 눌러도 아무 일이 없는 링크는 고장으로 보이지 않는다. */
    if (!item.href) {
      return `<span>${label}</span>`;
    }

    const here = item.href === current ? ' aria-current="page"' : '';

    return `<a href="${escapeHtml(item.href)}"${here}>${label}</a>`;
  }).join('');

  return `<header class="gnb">
      <div class="wrap">
        <a class="logo" href="/">
          <span style="color:var(--tint);display:flex">${mark(26)}</span>
          <b>${escapeHtml(SITE.name)}</b>
        </a>
        <nav aria-label="주요 메뉴">${menu}</nav>
        <div class="side">
          <!--
            로그인은 앱에서 한다. 웹에 로그인 칸을 두면 웹에서 계정을 만들 수 있다는
            말이 되고, 우리웨딩·Pick은 웹에 없어서 만들어도 볼 것이 없다.
          -->
          <a class="btn btn-primary btn-sm" href="#app">앱에서 시작하기</a>
        </div>
      </div>
    </header>`;
}

/**
 * Footer.
 *
 * **약관 링크는 `POLICY_DOCUMENTS`에서 온다.** 확정본이 게시되지 않은 문서는
 * 링크로 만들지 않고 상태를 그대로 적는다 — 앱 정책 화면과 소개 한 장이 같은
 * 것을 보고 있어서, 한쪽만 «게시됨»이 되는 일이 없다.
 *
 * 웹의 「업체 · 플래너」 B2B 문의 창구(광고·제휴, 플래너 등록 포함)는 파기됐다
 * (2026-09-04 정책 변경 — 플래너 연결 기능 전체 파기, 차후 도입 예정). 업체 정보
 * 정정은 앱의 MY → 문의하기로만 받는다.
 */
function footer(): string {
  const policies = POLICY_DOCUMENTS.map((policy) => {
    const title = escapeHtml(policy.title);

    if (!policy.url) {
      return `<li>${title} · ${escapeHtml(policy.status)}</li>`;
    }

    /*
     * `#analysis-notice`처럼 문서 안을 가리키는 주소는 **소개 한 장 안에 있다.**
     * 그대로 걸면 홈에서 눌렀을 때 아무 데도 가지 않는다 — 끊긴 링크는 고장으로
     * 보이지 않아서 아무도 안 고친다.
     */
    const href = policy.url.startsWith('#') ? `${LANDING_PATH}${policy.url}` : policy.url;

    return `<li><a href="${escapeHtml(href)}">${title}</a></li>`;
  }).join('');

  return `<footer>
      <div class="wrap">
        <ul class="foot-cols">
          <li>
            <h2>서비스</h2>
            <ul>
              <li><a href="/">업체 ${escapeHtml(TERMS.search)}</a></li>
              <li>${escapeHtml(TERMS.verifiedData)}</li>
              <li>웨딩 정보</li>
            </ul>
          </li>
          <li>
            <h2>이용안내</h2>
            <ul>${policies}</ul>
          </li>
          <li>
            <h2>앱</h2>
            <!--
              스토어 주소를 지어 적지 않는다. 아직 올리지 않았고, 없는 주소를 걸면
              사람들이 아무것도 없는 곳으로 간다.
            -->
            <ul><li>출시 준비 중이에요</li></ul>
          </li>
        </ul>
        <div class="foot-bottom">
          ${FOOTER_BOTTOM.map((line) => `<p>${escapeHtml(line)}</p>`).join('')}
        </div>
      </div>
    </footer>`;
}

/** 앱으로 넘어가는 자리. 스토어에 올리기 전이라 링크 대신 상태를 적는다. */
function appAnchor(): string {
  return `<section id="app" class="wrap" style="padding-block:0 64px">
      <p class="pending">
        ${escapeHtml(TERMS.pick)}과 우리웨딩은 앱에서 이어져요. 앱은 출시 준비 중이고,
        준비되면 이 자리에 받는 곳을 적어요.
      </p>
    </section>`;
}

/**
 * 문서 한 장.
 *
 * 자바스크립트를 켜지 않아도 읽히고 눌린다 — 검색으로 들어온 사람에게 스크립트가
 * 도는지는 우리 사정이다. 검색칸도 GET form이라 스크립트 없이 넘어간다.
 */
export function siteDocument(input: {
  path: string;
  title: string;
  description: string;
  current: string | null;
  body: string;
}): string {
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(input.title)}</title>
<meta name="description" content="${escapeHtml(input.description)}">
${socialMeta(input.path, input.title, input.description)}
<style>${SITE_STYLES}</style>
</head>
<body>
<a class="skip" href="#main">본문으로 건너뛰기</a>
${gnb(input.current)}
<main id="main">
${input.body}
${appAnchor()}
</main>
${footer()}
</body>
</html>
`;
}
