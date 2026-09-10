import tokens from '../../../spec/tokens.json';
import strings from '../../../spec/strings.ko.json';

/**
 * 링크 미리보기(OG 카드)에 쓰는 1200×630 이미지를 만든다.
 *
 * **왜 손으로 그린 SVG를 두지 않고 여기서 만드는가.** 전에는 `weddingpick-og.svg`가
 * 「확인하고 · 비교해서 골라요」를 담고 있었는데 랜딩은 「웨딩 준비, 하나씩 쉽게
 * 골라봐요」로 바뀐 뒤였다. 링크를 공유하면 사이트에 없는 문구가 먼저 보였다.
 * 그림 안의 글자를 손으로 적어 두면 문구를 고칠 때 한쪽만 고쳐진다.
 *
 * 그래서 문구는 `spec/strings.ko.json`, 색은 `spec/tokens.json`에서만 온다. 이 함수가
 * 내놓는 SVG와 저장소에 든 파일이 같은지는 `og-image.test.ts`가 지킨다.
 *
 * **PNG는 여기서 만들지 않는다.** 카카오·페이스북 크롤러가 SVG를 읽지 않아 실제로
 * 내보내는 것은 PNG이고, 변환에는 브라우저와 한글 폰트가 필요하다. 굽는 방법은
 * `apps/web/README.md`의 「링크 미리보기 이미지」에 적어 두었다.
 */
const COPY = strings.webLanding;
const CORAL = tokens.color.brand.primary.value;
const INK = tokens.color.text.ink.value;
const SECONDARY = tokens.color.text.secondary.value;
const PAPER = tokens.color.surface.paper.value;
const CARD = tokens.color.brand.primarySurface.value;

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

/**
 * 브랜드 잠금장치(마크 + 이름)의 자리.
 *
 * 마크는 24 단위 그림을 3배로 키워 72이고 이름은 48px 네 글자다. 둘을 24 간격으로
 * 붙인 폭을 가운데에 맞춘다 — 예전 파일은 마크를 460, 이름을 610에 두어 묶음 전체가
 * 왼쪽으로 29 치우쳐 있었다.
 */
const MARK_SIZE = 72;
const MARK_GAP = 24;
const BRAND_SIZE = 48;
const BRAND_WIDTH = BRAND_SIZE * COPY.brand.length;
const LOCKUP_LEFT = (OG_WIDTH - (MARK_SIZE + MARK_GAP + BRAND_WIDTH)) / 2;
const MARK_TOP = 146;

function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** 첫 줄은 먹색, 둘째 줄은 코랄. 랜딩 히어로가 강조를 나누는 방식과 같다. */
function heroLines(): string[] {
  return COPY.hero.split('\n');
}

/** 링크 미리보기에서 이미지를 못 읽는 사람에게 읽히는 글. 그림의 글자와 같아야 한다. */
export function ogImageAlt(): string {
  return `${COPY.brand} — ${heroLines().join(' ')}`;
}

export function ogImageSvg(): string {
  const [heroTop = '', heroBottom = ''] = heroLines();
  const markPaths = tokens.symbol.paths
    .map((d) => `<path d="${d}"/>`)
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_WIDTH}" height="${OG_HEIGHT}" viewBox="0 0 ${OG_WIDTH} ${OG_HEIGHT}">
<rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="${PAPER}"/>
<rect width="${OG_WIDTH}" height="18" fill="${CORAL}"/>
<rect x="48" y="48" width="1104" height="534" rx="28" fill="${CARD}"/>
<g transform="translate(${LOCKUP_LEFT} ${MARK_TOP}) scale(3)" fill="${tokens.symbol.fill}" stroke="${CORAL}" stroke-width="${tokens.symbol.strokeWidth}" stroke-linecap="${tokens.symbol.strokeLinecap}" stroke-linejoin="${tokens.symbol.strokeLinejoin}">${markPaths}</g>
<g font-family="NanumSquare, 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif">
<text x="${LOCKUP_LEFT + MARK_SIZE + MARK_GAP}" y="${MARK_TOP + 52}" font-size="${BRAND_SIZE}" font-weight="700" fill="${INK}">${escapeText(COPY.brand)}</text>
<g text-anchor="middle">
<text x="600" y="304" font-size="26" fill="${SECONDARY}">${escapeText(COPY.eyebrow)}</text>
<text x="600" y="386" font-size="58" font-weight="700" fill="${INK}">${escapeText(heroTop)}</text>
<text x="600" y="470" font-size="58" font-weight="700" fill="${CORAL}">${escapeText(heroBottom)}</text>
</g>
</g>
</svg>
`;
}
