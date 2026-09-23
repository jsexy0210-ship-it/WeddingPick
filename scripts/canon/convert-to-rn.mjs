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
 * 사용:
 *   node scripts/canon/convert-to-rn.mjs --file "docs/design/html/<파일>.dc.html"
 *   node scripts/canon/convert-to-rn.mjs --all
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

function convertOne(rawCss, decls) {
  const style = {};
  const webOnlyOrInvalid = {};
  const unconverted = [];
  for (const { prop, value } of decls) {
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
  return { raw: rawCss, style, webOnlyOrInvalid, unconverted };
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
  const withIssues = results.filter((r) => r.unconverted.length > 0 || Object.keys(r.webOnlyOrInvalid).length > 0);

  return {
    file: path.relative(REPO_ROOT, filePath),
    convertedAtUtc: new Date().toISOString(),
    tool: 'css-to-react-native-transform',
    renderValsError,
    summary: {
      uniqueDeclarationBlocks: results.length,
      fullyConverted: fullyConverted.length,
      withIssues: withIssues.length,
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
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || (!args.file && !args.all)) {
    console.log('사용: node scripts/canon/convert-to-rn.mjs --file "<...dc.html>" | --all');
    process.exit(args.help ? 0 : 1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const files = args.all
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
      `완전 변환 ${report.summary.fullyConverted} · 검토 필요 ${report.summary.withIssues}`,
    );
  }

  const indexPath = path.join(OUT_DIR, '_index.json');
  fs.writeFileSync(indexPath, JSON.stringify({ generatedAtUtc: new Date().toISOString(), files: indexRows }, null, 2) + '\n', 'utf8');
  console.error(`\n인덱스: ${path.relative(REPO_ROOT, indexPath)}`);
}

main();
