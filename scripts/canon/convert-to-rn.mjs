#!/usr/bin/env node
/**
 * 정본 .dc.html의 CSS 선언을 `css-to-react-native-transform`으로 실행해서 RN 스타일
 * 객체로 자동 변환한다(2026-09-23 대표 지시 — 「css-to-react-native-transform을 이용해
 * RN 스타일 객체로 변환한다」).
 *
 * **이 도구가 하는 일은 값(스타일) 변환뿐이다.** HTML 구조를 RN 컴포넌트로 옮기는 것은
 * 별도 작업이다(같은 지시 — 「HTML 구조의 RN 컴포넌트 변환은 별도로 수행한다」). 원본
 * `docs/design/html/*.dc.html`은 읽기만 하고 덮어쓰지 않는다 — 출력은
 * `docs/rn-migration/css-to-rn/`에 새 파일로 쌓는다.
 *
 * **변환 안 되는 것은 지우지 않는다.** `css-to-react-native-transform`이 파싱 실패로
 * 던지는 선언(`box-shadow`의 다중값, `linear-gradient`, `transform:translateX(-50%)` 같은
 * CSS 함수 값, `calc()`가 낀 산술 등)은 원본 선언 텍스트·나온 위치(키 경로)·대체 구현
 * 방법 메모와 함께 `unconverted` 목록에 남긴다.
 *
 * **"성공"도 곧이곧대로 믿지 않는다.** 이 패키지는 RN이 실제로 그 속성을 지원하는지
 * 검사하지 않는다 — `cursor`·`transition`·`outline`·`textOverflow`·`whiteSpace`·
 * `backdropFilter` 같은 웹 전용 속성도 타입만 맞으면 "변환 성공"으로 돌려준다. 그런
 * 항목은 `webOnlyOrInvalid`로 따로 갈라 표시한다 — RN 네이티브에는 쓸 수 없다.
 *
 * **범위는 앱 화면 6개뿐이다**(2026-09-23 대표 지시 — 「관리자, 랜딩 사이트는 변환
 * 필요없다. 앱화면만 변환하면 된다」). `docs/design/README.md`의 "사용자 화면 (앱)" 표에
 * 있는 6개(`대메뉴_홈(로그인, 온보딩)` · `대메뉴_검색` · `대메뉴_Pick` · `대메뉴_웨딩노트` ·
 * `대메뉴_MY` · `공통_다이얼로그 빈상태 로더`)만 다룬다. 관리자·랜딩·약관방침·IA·
 * 컴포넌트시트·사용자흐름·스토어이미지·디바이스대응(웹/문서류 10개)은 대상이 아니다.
 *
 * **2차 변환 — "못 고친 나머지"도 손으로 규칙을 만들어 더 풀었다**(같은 지시 —
 * 「못고친 나머지도 변환 진행해라」). `css-to-react-native-transform`이 통째로 포기하는
 * `box-shadow`·`linear-gradient`·가운데 정렬 `transform:translate(-50%,-50%)`, 그리고
 * "타입은 맞지만 RN 네이티브엔 없는" `cursor`·`white-space`·`text-overflow`·
 * `-webkit-line-clamp` 같은 웹 전용 속성을 이 파일이 직접 해석해서 실제 RN
 * 값(`borderBottomWidth` 등) 또는 컴포넌트 차원의 구체적 대체안(`numberOfLines` 등)을
 * `resolved`에 채운다. 그래도 못 푸는 것만 `unconverted`/`webOnlyOrInvalid`에 남는다.
 *
 * 사용:
 *   node scripts/canon/convert-to-rn.mjs --file "docs/design/html/<파일>.dc.html"
 *   node scripts/canon/convert-to-rn.mjs --app          # 앱 화면 6개만
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

// Node ESM↔CJS 상호운용이 이 패키지를 이중으로 감싼다(import 시 default.default가 진짜
// 함수다) — createRequire로 CJS를 직접 불러와 그 문제를 피한다.
const require = createRequire(import.meta.url);
const transform = require('css-to-react-native-transform').default;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const HTML_DIR = path.join(REPO_ROOT, 'docs/design/html');
const OUT_DIR = path.join(REPO_ROOT, 'docs/rn-migration/css-to-rn');

// docs/design/README.md의 "사용자 화면 (앱)" 표 그대로 — 관리자·랜딩·문서류는 뺀다.
const APP_SCREEN_FILES = [
  '대메뉴_홈(로그인, 온보딩).dc.html',
  '대메뉴_검색.dc.html',
  '대메뉴_Pick.dc.html',
  '대메뉴_웨딩노트.dc.html',
  '대메뉴_MY.dc.html',
  '공통_다이얼로그 빈상태 로더.dc.html',
];

// RN 네이티브(iOS·Android)에 실제로 없는 웹 전용/무효 속성 — "변환 성공"이어도 그대로 못 쓴다.
const WEB_ONLY_OR_INVALID = new Set([
  'cursor', 'transition', 'outline', 'outlineOffset', 'textOverflow', 'whiteSpace',
  'backdropFilter', 'WebkitLineClamp', 'boxSizing', 'userSelect', 'appearance',
  'textDecoration', 'listStyle', 'listStyleType', 'verticalAlign', 'textIndent',
  'wordBreak', 'wordWrap', 'overflowX', 'overflowY', 'visibility', 'float', 'clear',
  'resize', 'WebkitBoxOrient', 'WebkitBoxAlign', 'content', 'willChange', 'isolation',
  'mixBlendMode', 'scrollBehavior', 'touchAction', 'pointerEvents' /* RN에도 있지만 값 체계가 다르다 */,
]);

function suggestAlternative(prop, rawDecl) {
  const p = prop.toLowerCase();
  const v = rawDecl.toLowerCase();
  if (p === 'box-shadow') {
    return 'RN은 box-shadow shorthand를 안 받는다 — iOS는 shadowColor/shadowOffset/shadowOpacity/shadowRadius, ' +
      'Android는 elevation으로 나눠 쓴다. packages/ui/src/theme.ts의 Elevation 토큰을 먼저 확인한다.';
  }
  if (v.includes('color-mix(')) {
    return 'RN은 color-mix() 미지원 — 결과 색을 미리 계산해 hex/rgba 리터럴로 박아 넣는다 ' +
      '(spec/tokens.json의 $derivation처럼 계산 과정을 주석에 남긴다).';
  }
  if (v.includes('gradient')) {
    return 'RN은 CSS 그라디언트 미지원 — expo-linear-gradient의 <LinearGradient> 컴포넌트로 별도 구현한다.';
  }
  if (p === 'transform' && /%/.test(v)) {
    return 'transform은 배열 문법(transform:[{translateX:N}])만 받고 %는 못 쓴다 — 실제 레이아웃 px로 ' +
      '재계산하거나 onLayout으로 실측해 넣는다.';
  }
  if (p === 'transform') {
    return 'RN transform은 배열 문법이다: transform:[{translateX:N},{rotate:"10deg"}] 형태로 값만 옮긴다.';
  }
  if (v.includes('calc(')) {
    return 'RN은 calc() 미지원 — 고정값으로 계산해 넣거나 onLayout/useWindowDimensions로 실측해 계산한다.';
  }
  if (p.startsWith('grid') || v.includes('display:grid') || v.includes('display: grid')) {
    return 'RN은 CSS Grid 미지원 — Flexbox(row/column + flexWrap)로 재구성한다.';
  }
  if (v.includes('sticky')) {
    return 'RN은 position:sticky 미지원 — 스크롤 이벤트(onScroll) 기반으로 직접 구현한다.';
  }
  if (p === 'clip-path') {
    return 'RN은 clip-path 미지원 — 마스킹이 꼭 필요하면 react-native-svg의 <ClipPath>로 구현한다.';
  }
  if (p === 'filter') {
    return 'RN 코어는 CSS filter 미지원 — 블러 등은 expo-blur, 그 외는 이미지 사전 가공을 검토한다.';
  }
  return '수동 검토 필요 — 원본 선언과 에러 메시지를 보고 이 화면 담당 세션이 판단한다.';
}

function readScriptBody(html) {
  const re = /<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/g;
  const bodies = [];
  let m;
  while ((m = re.exec(html))) bodies.push(m[1]);
  if (bodies.length === 0) throw new Error('<script type="text/x-dc"> 블록을 못 찾았다.');
  return bodies.join('\n');
}

// 일부 정본 파일(랜딩 계열)은 renderVals() 안에서 React.createElement(...)로 아이콘 SVG를
// 직접 만든다 — 우리는 그 결과(엘리먼트 트리)를 쓰지 않고 CSS 선언 문자열만 보므로, 안
// 터지게만 스텁한다.
function stubReact() {
  const createElement = (type, props, ...children) => ({ __reactStub: true, type, props, children });
  return { createElement, Fragment: Symbol('Fragment') };
}

function evalRenderVals(scriptBody, fileLabel) {
  const wrapped = `(function(React) {\n  class DCLogic {}\n  ${scriptBody}\n  return new Component().renderVals();\n})`;
  const fn = vm.runInThisContext(wrapped, { filename: fileLabel });
  return fn(stubReact());
}

// renderVals()가 돌려주는 값 중 "CSS 선언처럼 생긴" 문자열만 스타일로 본다 — 업체명·문구 같은
// 일반 데이터 문자열(예: "9:41", "강남 A 스튜디오")까지 CSS로 오판하지 않는다.
const CSS_PROP_RE = /^-?[a-zA-Z][a-zA-Z-]*$/;
function parseCssDecls(str) {
  const decls = [];
  for (const part of str.split(';')) {
    const idx = part.indexOf(':');
    if (idx === -1) continue;
    const prop = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (!prop || !value || !CSS_PROP_RE.test(prop)) return null; // 하나라도 CSS 속성명이 아니면 이 문자열 전체를 데이터로 본다
    decls.push({ prop, value });
  }
  return decls.length > 0 ? decls : null;
}

/** resolved 객체를 재귀로 훑어 "CSS 선언처럼 생긴" leaf 문자열을 전부 모은다(중복은 키 경로만 누적). */
function collectCssStrings(value, keyPath, out) {
  if (typeof value === 'string') {
    const decls = parseCssDecls(value);
    if (decls) {
      if (!out.has(value)) out.set(value, { decls, keyPaths: [] });
      out.get(value).keyPaths.push(keyPath);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => collectCssStrings(v, `${keyPath}[${i}]`, out));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) collectCssStrings(v, keyPath ? `${keyPath}.${k}` : k, out);
  }
}

/**
 * 일부 정본 파일(관리자류)은 `style="{{ key }}"` 템플릿 바인딩이 아니라 마크업에
 * `style="display:flex;..."`처럼 값을 직접 박아 둔다 — renderVals()로는 안 잡히므로
 * 마크업 문자열에서 따로 긁는다.
 */
function collectLiteralStyleAttrs(html, out) {
  const scriptStart = html.indexOf('<script type="text/x-dc"');
  const markup = scriptStart === -1 ? html : html.slice(0, scriptStart);
  const re = /style="([^"{][^"]*)"/g;
  let m;
  let i = 0;
  while ((m = re.exec(markup))) {
    const raw = m[1];
    const decls = parseCssDecls(raw);
    if (!decls) continue;
    if (!out.has(raw)) out.set(raw, { decls, keyPaths: [] });
    out.get(raw).keyPaths.push(`literal-style-attr[${i++}]`);
  }
}

// ── 2차 변환: css-to-react-native-transform이 포기하는 자리를 규칙 기반으로 직접 푼다 ──

function splitTopLevelCommas(str) {
  const parts = [];
  let depth = 0;
  let cur = '';
  for (const ch of str) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

function parsePxOrZero(tok) {
  if (tok === '0') return 0;
  const m = /^(-?[\d.]+)px$/.exec(tok);
  return m ? parseFloat(m[1]) : null; // null = px가 아닌 단위(vmax 등) — "모른다"를 명시적으로 표시한다
}

function parseShadowLayer(layer) {
  let s = layer.trim();
  let inset = false;
  if (/^inset\s+/.test(s)) { inset = true; s = s.replace(/^inset\s+/, ''); }
  else if (/\sinset$/.test(s)) { inset = true; s = s.replace(/\sinset\s*$/, ''); }

  const tokens = s.split(/\s+/).filter(Boolean);
  let color = null;
  const lengthToks = [];
  for (const t of tokens) {
    if (t.startsWith('#') || /^(rgba?|hsla?)\(/i.test(t) || /^[a-z]+$/i.test(t)) color = t;
    else lengthToks.push(t);
  }
  const at = (i) => (lengthToks[i] !== undefined ? parsePxOrZero(lengthToks[i]) : 0);
  const offsetX = at(0);
  const offsetY = at(1);
  const blur = at(2);
  const spread = at(3);
  const hasUnresolvedUnit = [offsetX, offsetY, blur, spread].some((v) => v === null);
  return { inset, offsetX, offsetY, blur, spread, color, hasUnresolvedUnit, lengthToks };
}

function extractAlpha(color) {
  const m = /rgba?\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\s*\)/.exec(color || '');
  return m ? parseFloat(m[1]) : null;
}

function stripAlphaToRgb(color) {
  if (!color) return null;
  const m = /rgba?\(([^,]+),([^,]+),([^,]+)/.exec(color);
  return m ? `rgb(${m[1].trim()}, ${m[2].trim()}, ${m[3].trim()})` : color;
}

/** box-shadow 레이어 하나를 RN 값으로 분류한다 — 이 코드베이스의 box-shadow는 전부 "테두리
 * 대신 쓴 것"이거나 "링/글로우"였지 진짜 확산 그림자가 아니었다(2026-09-23 조사, 15개
 * 고유값 전수 확인). 그래서 대부분 border*로 정확히 옮겨진다. */
function shadowLayerToRN(layer) {
  const { inset, offsetX, offsetY, blur, spread, color, hasUnresolvedUnit, lengthToks } = layer;
  if (hasUnresolvedUnit) {
    return { kind: 'UNRESOLVED_UNIT', note: `px가 아닌 단위가 섞여 있다(${lengthToks.join(', ')}) — 고정 px로 재실측하거나 생략을 검토한다.` };
  }
  if (offsetX === 0 && offsetY === 0 && blur === 0 && spread !== 0) {
    return {
      kind: 'RING_BORDER',
      style: { borderWidth: Math.abs(spread), ...(color ? { borderColor: color } : {}) },
      note: inset
        ? `사방 ${Math.abs(spread)}px 인셋 링 — borderWidth로 정확히 옮겨진다.`
        : `사방 ${Math.abs(spread)}px 아웃셋 글로우 — RN border는 안쪽으로만 그려져 박스가 시각적으로 살짝 작아 보일 수 있다. 화면에서 눈으로 확인한다.`,
    };
  }
  if (blur === 0 && spread === 0 && offsetX === 0 && offsetY !== 0) {
    const side = inset ? (offsetY < 0 ? 'Bottom' : 'Top') : (offsetY < 0 ? 'Top' : 'Bottom');
    return { kind: 'EDGE_BORDER', style: { [`border${side}Width`]: Math.abs(offsetY), ...(color ? { [`border${side}Color`]: color } : {}) } };
  }
  if (blur === 0 && spread === 0 && offsetY === 0 && offsetX !== 0) {
    const side = inset ? (offsetX < 0 ? 'Right' : 'Left') : (offsetX < 0 ? 'Left' : 'Right');
    return { kind: 'EDGE_BORDER', style: { [`border${side}Width`]: Math.abs(offsetX), ...(color ? { [`border${side}Color`]: color } : {}) } };
  }
  if (blur > 0) {
    const alpha = extractAlpha(color);
    return {
      kind: 'DIFFUSE_SHADOW',
      style: {
        shadowColor: stripAlphaToRgb(color) ?? '#000',
        shadowOffset: { width: offsetX, height: offsetY },
        shadowOpacity: alpha ?? 1,
        shadowRadius: blur / 2,
        elevation: Math.max(1, Math.round(blur / 2)),
      },
      note: 'iOS는 shadow*로 정확하고, Android elevation은 색·오프셋 없는 단일 수치 근사치다 — 실기기에서 확인한다.',
    };
  }
  return { kind: 'UNKNOWN', note: '패턴을 못 알아봤다 — 원본 값을 보고 수동으로 판단한다.' };
}

function resolveBoxShadow(rawValue) {
  const layers = splitTopLevelCommas(rawValue).map(parseShadowLayer).map(shadowLayerToRN);
  const style = {};
  const notes = [];
  layers.forEach((layer, i) => {
    if (layer.style) Object.assign(style, layer.style);
    if (layer.note) notes.push(layers.length > 1 ? `레이어 ${i + 1}: ${layer.note}` : layer.note);
  });
  if (layers.length > 1) {
    notes.push(`원본이 box-shadow를 ${layers.length}겹 썼다 — RN View 하나는 그림자를 하나만 그리므로, 겹쳐야 할 층은 안쪽에 View를 하나 더 두고 나눠 건다.`);
  }
  return { style, note: notes.join(' ') };
}

// `background: linear-gradient(...)`를 expo-linear-gradient의 <LinearGradient> props로 옮긴다.
function resolveGradient(rawValue) {
  const m = /gradient\((.*)\)$/s.exec(rawValue.trim());
  if (!m) return null;
  const parts = splitTopLevelCommas(m[1]);
  let start = { x: 0, y: 0 };
  let end = { x: 0, y: 1 }; // CSS 기본 방향(위→아래)
  let stopParts = parts;
  if (/^to\s+/i.test(parts[0]) || /^-?\d+deg$/i.test(parts[0])) {
    const dir = parts[0].trim().toLowerCase();
    stopParts = parts.slice(1);
    if (dir === 'to top') { start = { x: 0, y: 1 }; end = { x: 0, y: 0 }; }
    else if (dir === 'to bottom') { start = { x: 0, y: 0 }; end = { x: 0, y: 1 }; }
    else if (dir === 'to left') { start = { x: 1, y: 0 }; end = { x: 0, y: 0 }; }
    else if (dir === 'to right') { start = { x: 0, y: 0 }; end = { x: 1, y: 0 }; }
    else return { unresolvedDirection: dir }; // 각도(deg) 등 — start/end 좌표 계산은 수동으로
  }
  const stops = stopParts.map((s) => {
    const sm = /^(.*?)(?:\s+(-?[\d.]+)%)?$/.exec(s.trim());
    return { color: sm[1].trim(), location: sm[2] !== undefined ? parseFloat(sm[2]) / 100 : null };
  });
  return { colors: stops.map((s) => s.color), locations: stops.map((s) => s.location), start, end };
}

// 같은 style="" 블록에 나오는 다른 선언(width/height 등)을 참고해야 하는 것들(가운데 정렬
// transform 등)을 위해, 개별 prop이 아니라 decls 전체를 보고 판단하는 "블록 단위 규칙"이다.
function resolveBlockIdioms(decls) {
  const byProp = new Map(decls.map((d) => [d.prop, d.value]));
  const consumed = new Set();
  const resolved = [];

  // ellipsis 한 줄 자르기: white-space:nowrap + overflow:hidden + text-overflow:ellipsis
  if (byProp.get('white-space') === 'nowrap' && byProp.get('text-overflow') === 'ellipsis') {
    consumed.add('white-space');
    consumed.add('text-overflow');
    resolved.push({
      props: ['white-space', 'text-overflow'],
      kind: 'ELLIPSIS_TEXT',
      componentNote: 'style이 아니라 컴포넌트 prop이다 — 해당 <Text numberOfLines={1} ellipsizeMode="tail">로 구현한다.',
    });
  }

  // 여러 줄 자르기: -webkit-line-clamp:N (+ -webkit-box-orient:vertical + display:-webkit-box)
  if (byProp.has('-webkit-line-clamp')) {
    const n = byProp.get('-webkit-line-clamp');
    consumed.add('-webkit-line-clamp');
    if (byProp.get('-webkit-box-orient') === 'vertical') consumed.add('-webkit-box-orient');
    if (byProp.get('display') === '-webkit-box') consumed.add('display');
    resolved.push({
      props: ['-webkit-line-clamp', '-webkit-box-orient', 'display'],
      kind: 'LINE_CLAMP_TEXT',
      componentNote: `style이 아니라 컴포넌트 prop이다 — 해당 <Text numberOfLines={${n}}>로 구현한다.`,
    });
  }

  // 가운데 정렬: transform:translate(-50%,-50%) 또는 translateY(-50%) — 같은 블록에 고정 px
  // width/height가 있으면 margin으로 정확히 치환하고, 없으면 공식만 안내한다.
  if (byProp.has('transform') && /-50%/.test(byProp.get('transform'))) {
    consumed.add('transform');
    const val = byProp.get('transform');
    const wPx = parsePxOrZero((byProp.get('width') || '').trim());
    const hPx = parsePxOrZero((byProp.get('height') || '').trim());
    const both = /translate\(-50%,\s*-50%\)/.test(val);
    const yOnly = /translateY\(-50%\)/.test(val);
    const xOnly = /translateX\(-50%\)/.test(val);
    const style = {};
    const canMarginLeft = (both || xOnly) && wPx !== null && wPx !== 0;
    const canMarginTop = (both || yOnly) && hPx !== null && hPx !== 0;
    if (canMarginLeft) style.marginLeft = -wPx / 2;
    if (canMarginTop) style.marginTop = -hPx / 2;
    resolved.push({
      props: ['transform'],
      kind: 'CENTER_TRANSFORM',
      style: Object.keys(style).length > 0 ? style : undefined,
      componentNote:
        Object.keys(style).length > 0
          ? `position:'absolute', top:'50%'/left:'50%'(원본에 있어야 함)와 함께 marginLeft/marginTop으로 정확히 중앙 정렬된다(width/height 고정값 기준 계산).`
          : `같은 블록에 고정 px width/height가 없어 자동 계산을 못 했다 — position:'absolute', top:'50%', left:'50%', marginLeft:-너비/2, marginTop:-높이/2 공식으로 직접 넣는다. transform 배열 문법(%불가)은 쓸 수 없다.`,
    });
  }

  // 블랭킷 규칙 — 값과 무관하게 같은 결론인 것들.
  const BLANKET = {
    'cursor': { componentNote: 'RN 네이티브에는 커서가 없다 — Pressable/TouchableOpacity가 이미 처리하므로 그냥 뺀다.' },
    'box-sizing': { componentNote: 'RN Yoga 레이아웃은 기본적으로 border-box와 같은 방식이라 이 속성 자체가 불필요하다 — 뺀다.' },
    'overflow-x': { componentNote: 'RN은 축별 overflow 제어가 없다 — style.overflow는 "hidden"/"visible"만 쓰고, 가로 스크롤이 필요하면 ScrollView의 horizontal prop을 쓴다.' },
    'overflow-y': { componentNote: 'RN은 축별 overflow 제어가 없다 — style.overflow는 "hidden"/"visible"만 쓰고, 세로 스크롤은 ScrollView 기본값을 쓴다.' },
    'word-break': { componentNote: 'RN Text는 word-break 미지원 — 기본 줄바꿈 정책을 따른다. 긴 URL 등 강제 줄바꿈이 꼭 필요하면 문자열 자체를 끊어 넣는다.' },
    'word-wrap': { componentNote: 'RN Text는 word-wrap 미지원 — flexShrink/maxWidth로 컨테이너 폭을 제한해 자연스럽게 줄바꿈시킨다.' },
    'white-space': {
      // ellipsis 조합(위에서 이미 소비)이 아니라 nowrap만 단독으로 쓰인 자리 — RN Text는
      // 기본이 줄바꿈이라 "줄바꿈 금지"에 대응하는 건 style이 아니라 numberOfLines다.
      componentNote: (v) => (v === 'nowrap'
        ? 'RN Text는 기본적으로 줄바꿈된다 — 한 줄을 유지하려면 해당 <Text numberOfLines={1}>을 쓴다(말줄임 없이 자르려면 ellipsizeMode="clip").'
        : `CSS white-space:${v}는 RN에 대응 속성이 없다 — 문맥에 맞게 컴포넌트에서 처리한다.`),
    },
    'pointer-events': {
      componentNote: (v) => `RN pointerEvents prop 값 체계가 다르다(box-none·box-only 추가) — CSS "${v}"는 보통 RN "${v === 'none' ? 'none' : 'auto'}"에 대응하지만 자식까지 살릴지(box-none) 직접 확인한다.`,
    },
    'order': { componentNote: 'RN/Yoga 버전에 따라 order 지원이 갈린다 — 믿지 말고 JSX에서 자식 순서 자체를 바꾸는 쪽이 모든 버전에서 안전하다.' },
    'font-family': { style: { fontFamily: 'Pretendard' }, componentNote: 'RN fontFamily는 웹처럼 폴백 목록을 못 받는다 — 네이티브는 Pretendard 단일(packages/ui/src/theme.ts FontFamily 토큰), 이 목록의 나머지는 웹 폴백이라 무시한다.' },
  };
  for (const [prop, rule] of Object.entries(BLANKET)) {
    if (consumed.has(prop) || !byProp.has(prop)) continue;
    consumed.add(prop);
    const note = typeof rule.componentNote === 'function' ? rule.componentNote(byProp.get(prop)) : rule.componentNote;
    resolved.push({ props: [prop], kind: 'BLANKET', style: rule.style, componentNote: note });
  }

  return { consumed, resolved };
}

function convertOne(rawCss, decls) {
  const style = {};
  const webOnlyOrInvalid = {};
  const unconverted = [];
  const resolvedIdioms = [];

  // 1) 블록 전체를 보고 판단해야 하는 것들(ellipsis 조합, 중앙정렬 transform, 블랭킷 규칙)부터 뗀다.
  const { consumed, resolved } = resolveBlockIdioms(decls);
  for (const r of resolved) {
    if (r.style) Object.assign(style, r.style);
    resolvedIdioms.push(r);
  }

  for (const { prop, value } of decls) {
    if (consumed.has(prop)) continue;

    // 2) box-shadow·gradient는 라이브러리가 포기하는 자리라 직접 판별해서 넣는다.
    if (prop === 'box-shadow') {
      const { style: shadowStyle, note } = resolveBoxShadow(value);
      Object.assign(style, shadowStyle);
      resolvedIdioms.push({ props: [prop], kind: 'BOX_SHADOW', style: shadowStyle, componentNote: note });
      continue;
    }
    if (prop === 'background' && /gradient\(/.test(value)) {
      const gradient = resolveGradient(value);
      if (gradient && !gradient.unresolvedDirection) {
        resolvedIdioms.push({
          props: [prop],
          kind: 'LINEAR_GRADIENT',
          componentNote: `style이 아니라 컴포넌트다 — expo-linear-gradient의 <LinearGradient colors={${JSON.stringify(gradient.colors)}} locations={${JSON.stringify(gradient.locations)}} start={${JSON.stringify(gradient.start)}} end={${JSON.stringify(gradient.end)}} />로 옮긴다(locations가 null인 자리는 균등 분배).`,
        });
        continue;
      }
      if (gradient?.unresolvedDirection) {
        unconverted.push({ prop, value, note: `그라디언트 방향(${gradient.unresolvedDirection})이 각도라 start/end 좌표 자동 계산을 안 했다 — 수동으로 좌표를 정한다.`, kind: 'FAILED' });
        continue;
      }
    }

    // 3) 나머지는 기존대로 css-to-react-native-transform에 맡긴다.
    const warnings = [];
    const origWarn = console.warn;
    console.warn = (...args) => warnings.push(args.join(' '));
    try {
      const out = transform(`.s{${prop}:${value};}`);
      const rnEntries = Object.entries(out.s ?? {});
      for (const [rnProp, rnVal] of rnEntries) {
        if (WEB_ONLY_OR_INVALID.has(rnProp)) webOnlyOrInvalid[rnProp] = rnVal;
        else style[rnProp] = rnVal;
      }
      if (warnings.length > 0 && rnEntries.length > 0) {
        // 변환은 됐지만(예: -webkit-line-clamp 단위 경고) 라이브러리가 의심을 남긴 값이다.
        unconverted.push({ prop, value, note: `변환됐지만 경고 있음: ${warnings.join(' / ')}`, kind: 'WARNED' });
      }
    } catch (err) {
      unconverted.push({
        prop,
        value,
        error: err.message,
        alternative: suggestAlternative(prop, `${prop}:${value}`),
        kind: 'FAILED',
      });
    } finally {
      console.warn = origWarn;
    }
  }
  return { raw: rawCss, style, webOnlyOrInvalid, unconverted, resolvedIdioms };
}

function convertFile(filePath) {
  const html = fs.readFileSync(filePath, 'utf8');
  const collected = new Map();

  let renderValsError = null;
  try {
    const scriptBody = readScriptBody(html);
    const resolved = evalRenderVals(scriptBody, filePath);
    collectCssStrings(resolved, '', collected);
  } catch (err) {
    // renderVals()가 없거나 이 파일 구조에서 실행이 안 돼도, 마크업의 리터럴
    // style="..." 는 별도로 긁을 수 있으니 여기서 전체를 죽이지 않는다.
    renderValsError = err.message;
  }
  collectLiteralStyleAttrs(html, collected);

  const results = [];
  for (const [rawCss, { decls, keyPaths }] of collected) {
    const converted = convertOne(rawCss, decls);
    results.push({ ...converted, keyPaths, occurrences: keyPaths.length });
  }

  const fullyConverted = results.filter((r) => r.unconverted.length === 0 && Object.keys(r.webOnlyOrInvalid).length === 0);
  const idiomResolved = results.filter((r) => r.resolvedIdioms.length > 0);
  const stillOpen = results.filter((r) => r.unconverted.length > 0 || Object.keys(r.webOnlyOrInvalid).length > 0);

  return {
    file: path.relative(REPO_ROOT, filePath),
    convertedAtUtc: new Date().toISOString(),
    tool: 'css-to-react-native-transform + 규칙 기반 2차 변환',
    renderValsError,
    summary: {
      uniqueDeclarationBlocks: results.length,
      fullyConverted: fullyConverted.length,
      idiomResolved: idiomResolved.length,
      stillOpen: stillOpen.length,
    },
    results,
  };
}

function slugify(basename) {
  return basename
    .replace(/\.dc\.html$/, '')
    .replace(/[(),]/g, '')
    .replace(/\s+/g, '_');
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--file') out.file = argv[++i];
    else if (a === '--all') out.all = true;
    else if (a === '--app') out.app = true;
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || (!args.file && !args.all && !args.app)) {
    console.log(
      '사용: node scripts/canon/convert-to-rn.mjs --file "<...dc.html>" | --app(앱 화면 6개) | --all(정본 16개 전부)',
    );
    process.exit(args.help ? 0 : 1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const files = args.app
    ? APP_SCREEN_FILES.map((f) => path.join(HTML_DIR, f))
    : args.all
      ? fs.readdirSync(HTML_DIR).filter((f) => f.endsWith('.dc.html')).map((f) => path.join(HTML_DIR, f))
      : [path.resolve(REPO_ROOT, args.file)];

  const indexRows = [];
  for (const filePath of files) {
    const basename = path.basename(filePath);
    console.error(`변환 중: ${basename}`);
    const report = convertFile(filePath);
    const outPath = path.join(OUT_DIR, `${slugify(basename)}.json`);
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
    indexRows.push({
      source: report.file,
      output: path.relative(REPO_ROOT, outPath),
      ...report.summary,
    });
    console.error(
      `  ${basename}: 고유 선언 ${report.summary.uniqueDeclarationBlocks} · ` +
      `완전 변환 ${report.summary.fullyConverted} · 규칙으로 추가 해결 ${report.summary.idiomResolved} · ` +
      `아직 열림 ${report.summary.stillOpen}`,
    );
  }

  const indexPath = path.join(OUT_DIR, '_index.json');
  fs.writeFileSync(indexPath, JSON.stringify({ generatedAtUtc: new Date().toISOString(), files: indexRows }, null, 2) + '\n', 'utf8');
  console.error(`\n인덱스: ${path.relative(REPO_ROOT, indexPath)}`);
}

main();
