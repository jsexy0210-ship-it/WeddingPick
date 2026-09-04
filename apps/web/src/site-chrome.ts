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
 * 64칸 격자다. 24칸으로 잡으면 소수점이 붙어 눈으로 고치기 어렵다.
 */
const MARK_VIEWBOX = 64;
const MARK_HEART_PATH =
  'M32 19 C30 15 26 12 20 12 C13 12 8 17 8 24 C8 35 22 44 32 52 ' +
  'C42 44 56 35 56 24 C56 17 51 12 44 12 C38 12 34 15 32 19 Z';
const MARK_CHECK_PATH = 'M21 28 L28.5 35.5 L45 19';
const MARK_STROKE = 5;

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
 * 「업체 · 플래너」 열이 B2B 창구 진입점이다. 광고 · 제휴도 이 창구로 받는다 —
 * 따로 주소를 만들면 받는 사람이 둘로 갈린다.
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
            <h2>업체 · 플래너</h2>
            <ul>
              <li><a class="brand-link" href="#inquiry">업체 · 플래너 문의</a></li>
              <li><a href="#inquiry">업체 정보 정정</a></li>
              <li><a href="#inquiry">광고 · 제휴</a></li>
            </ul>
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

/**
 * 업체 · 플래너 창구.
 *
 * 웹에서 접수 폼을 열지 않는다 — 문의는 `INQUIRY_CATEGORY_RULES`가 항목마다
 * 무엇을 받아야 하는지 정해두었고, 그것을 웹에 다시 적으면 두 곳이 갈라진다.
 * 여기서 하는 일은 **어디로 오면 되는지 말하는 것**뿐이다.
 */
function inquiryAnchor(): string {
  return `<section id="inquiry" class="band">
      <div class="wrap">
        <h2>업체 · 플래너 문의</h2>
        <p class="pending" style="margin-top:24px">
          업체 정보 정정, 검색 노출 중단, 플래너 등록, 광고 · 제휴를 이 창구로 받아요.
          앱에서 <b>MY → 문의하기</b>로 보내실 수 있어요. 앱을 쓰지 않고 연락할 방법은 아직 마련하지 못했어요.
        </p>
      </div>
    </section>`;
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
${inquiryAnchor()}
</main>
${footer()}
</body>
</html>
`;
}
