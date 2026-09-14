import tokens from '../../../spec/tokens.json';
import strings from '../../../spec/strings.ko.json';

/**
 * 링크 미리보기(OG 카드)에 쓰는 1200×630 이미지를 만든다.
 *
 * **왜 손으로 그린 SVG를 두지 않고 여기서 만드는가.** 전에는 `weddingpick-og.svg`가
 * 「확인하고 · 비교해서 골라요」를 담고 있었는데 그 문구는 사이트 어디에도 없었다.
 * 그림 안의 글자를 손으로 적어 두면 문구를 고칠 때 한쪽만 고쳐지고, 그림이라
 * 아무도 눈치채지 못한다.
 *
 * 그래서 문구는 `spec/strings.ko.json`의 `webLanding.og`, 색은 `spec/tokens.json`에서만
 * 온다. 이 함수가 내놓는 SVG와 저장소에 든 파일이 같은지는 `og-image.test.ts`가 지킨다.
 *
 * **카드 문구는 랜딩 히어로와 따로 둔다.** 링크를 눌러보게 만드는 한 줄과 페이지를
 * 열었을 때 읽는 한 줄은 하는 일이 다르다 — 2026-09-10 사용자 시안이 그 둘을 갈랐다.
 *
 * **PNG는 여기서 만들지 않는다.** 카카오·페이스북 크롤러가 SVG를 읽지 않아 실제로
 * 내보내는 것은 PNG이고, 변환에는 브라우저와 한글 폰트가 필요하다. 굽는 방법은
 * `apps/web/README.md`의 「링크 미리보기 이미지」에 적어 두었다.
 */
const COPY = strings.webLanding;
const CORAL = tokens.color.brand.primary.value;
const ON_CORAL = tokens.color.brand.onPrimary.value;

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

/** 왼쪽 정렬 기준선. 브랜드 · 제목 · 부제가 모두 이 선에서 시작한다. */
const GUTTER = 95;

/* 마크는 24 단위 그림이라 배율로 키운다. 선 굵기도 함께 커져 코랄 바탕 위에서 또렷하다. */
const MARK_SCALE = 3.4;
const MARK_SIZE = 24 * MARK_SCALE;
const MARK_TOP = 142;
const BRAND_SIZE = 30;

function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function heroLines(): string[] {
  return COPY.og.hero.split('\n');
}

/** 링크 미리보기에서 이미지를 못 읽는 사람에게 읽히는 글. 그림의 글자와 같아야 한다. */
export function ogImageAlt(): string {
  return `${COPY.brand} — ${heroLines().join(' ')}`;
}

export function ogImageSvg(): string {
  const [heroTop = '', heroBottom = ''] = heroLines();
  const markPaths = tokens.symbol.paths.map((d) => `<path d="${d}"/>`).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_WIDTH}" height="${OG_HEIGHT}" viewBox="0 0 ${OG_WIDTH} ${OG_HEIGHT}">
<rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="${CORAL}"/>
<circle cx="1010" cy="560" r="250" fill="${ON_CORAL}" opacity="0.08"/>
<g transform="translate(${GUTTER} ${MARK_TOP}) scale(${MARK_SCALE})" fill="${tokens.symbol.fill}" stroke="${ON_CORAL}" stroke-width="${tokens.symbol.strokeWidth}" stroke-linecap="${tokens.symbol.strokeLinecap}" stroke-linejoin="${tokens.symbol.strokeLinejoin}">${markPaths}</g>
<g font-family="NanumSquare, 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif" fill="${ON_CORAL}">
<text x="${GUTTER + MARK_SIZE + 20}" y="${MARK_TOP + 52}" font-size="${BRAND_SIZE}" font-weight="700">${escapeText(COPY.brand)}</text>
<text x="${GUTTER}" y="366" font-size="66" font-weight="700">${escapeText(heroTop)}</text>
<text x="${GUTTER}" y="466" font-size="66" font-weight="700">${escapeText(heroBottom)}</text>
<text x="${GUTTER}" y="548" font-size="26" opacity="0.72">${escapeText(COPY.og.sub)}</text>
</g>
</svg>
`;
}
