#!/usr/bin/env node
/**
 * 정본 .dc.html 안의 <script type="text/x-dc"> renderVals()를 실제로 실행해서
 * 화면ID(WP-XXX-000)별로 쓰는 스타일 값을 있는 그대로 뽑아낸다.
 *
 * 왜 필요한가 — 2026-09-23 사고: 세션들이 이 값을 "읽고 판단"만 하고 실제로
 * 문자열 결합('flex:1;...' + (on.a ? '...' + INK : '...'))을 손으로 안 풀어봐서
 * 웨딩노트 탭이 정본과 완전히 다른 스타일(둥근 필 vs 밑줄형)로 구현됐다. 이 값은
 * 손으로 읽는 게 아니라 실행해서 뽑는다 — renderVals()는 순수 함수(this. 참조
 * 없음)라 Node vm으로 그대로 실행할 수 있다.
 *
 * 사용:
 *   node scripts/canon/extract-style.mjs --file "docs/design/html/대메뉴_웨딩노트.dc.html" --list-wp
 *   node scripts/canon/extract-style.mjs --file "...dc.html" --wp WP-NOTE-001
 *   node scripts/canon/extract-style.mjs --file "...dc.html" --key tabNav
 *   node scripts/canon/extract-style.mjs --file "...dc.html" --wp WP-NOTE-001 --json
 */
import fs from 'node:fs';
import vm from 'node:vm';

function parseArgs(argv) {
  const out = { json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--file') out.file = argv[++i];
    else if (a === '--wp') out.wp = argv[++i];
    else if (a === '--key') out.key = argv[++i];
    else if (a === '--list-wp') out.listWp = true;
    else if (a === '--json') out.json = true;
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

function usageAndExit(code) {
  console.log(`정본 .dc.html 스타일 추출기

  --file <path>     .dc.html 경로 (필수)
  --list-wp         파일 안의 WP-ID 전부 나열하고 끝
  --wp <WP-XXX-000> 그 화면ID 구역이 참조하는 top-level 키만 뽑는다
  --key <name>      특정 키 하나만 직접 뽑는다(WP-ID 몰라도 된다)
  --json            사람이 보는 표 대신 JSON으로 출력

--wp와 --key 중 하나는 반드시 준다(--list-wp 제외).`);
  process.exit(code);
}

function readScriptBody(html) {
  const re = /<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/g;
  const bodies = [];
  let m;
  while ((m = re.exec(html))) bodies.push(m[1]);
  if (bodies.length === 0) {
    throw new Error('<script type="text/x-dc"> 블록을 못 찾았다 — 이 파일이 정본 .dc.html 포맷이 맞는지 확인해라.');
  }
  return bodies.join('\n');
}

function evalRenderVals(scriptBody, fileLabel) {
  // renderVals()는 순수 함수다(this. 참조 없음) — DCLogic은 빈 베이스 클래스로 충분하다.
  const wrapped = `(function() {\n  class DCLogic {}\n  ${scriptBody}\n  return new Component().renderVals();\n})()`;
  try {
    return vm.runInThisContext(wrapped, { filename: fileLabel });
  } catch (err) {
    throw new Error(`renderVals() 실행 실패 — 정본 파일의 script 구조가 예상과 다를 수 있다: ${err.message}`);
  }
}

function findWpMarkers(html) {
  const scriptStart = html.indexOf('<script type="text/x-dc"');
  const markup = scriptStart === -1 ? html : html.slice(0, scriptStart);
  // WP-XXX-000 꼴만 화면ID로 본다. 관리자·컴포넌트 시트류는 이 패턴이 아니거나(다른 체계일
  // 수 있다) 본문 예시 데이터에 AD-052류 값이 섞여 있어 넓게 잡으면 오탐이 난다 —
  // --list-wp가 비면 그 파일은 이 도구로 화면ID 단위 조회가 안 된다는 뜻이니 --key로 직접 찾는다.
  const re = /\bWP-[A-Z]+-\d+[a-z]?\b/g;
  const markers = [];
  let m;
  while ((m = re.exec(markup))) markers.push({ id: m[0], index: m.index });
  return { markup, markers };
}

function keysForWp(markup, markers, wpId) {
  const idx = markers.findIndex((mk) => mk.id === wpId);
  if (idx === -1) return null;
  const start = markers[idx].index;
  const end = idx + 1 < markers.length ? markers[idx + 1].index : markup.length;
  const slice = markup.slice(start, end);
  const tokenRe = /\{\{\s*([A-Za-z_][\w]*)(?:\.[A-Za-z_][\w]*)*\s*\}\}/g;
  const keys = new Set();
  let m;
  while ((m = tokenRe.exec(slice))) keys.add(m[1]);
  return [...keys];
}

function parseCssString(str) {
  const out = {};
  for (const decl of str.split(';')) {
    const idx = decl.indexOf(':');
    if (idx === -1) continue;
    const prop = decl.slice(0, idx).trim();
    const val = decl.slice(idx + 1).trim();
    if (prop) out[prop] = val;
  }
  return out;
}

function printValue(key, value, indent = '') {
  if (typeof value === 'string') {
    // css-like 문자열이면(세미콜론+콜론 섞여 있으면) 속성별로 풀어서 보여준다.
    if (/:[^;]+;/.test(value) || (/^[a-z-]+:/.test(value) && value.includes(':'))) {
      const props = parseCssString(value);
      const propCount = Object.keys(props).length;
      if (propCount > 1) {
        console.log(`${indent}${key}:`);
        for (const [p, v] of Object.entries(props)) console.log(`${indent}  ${p}: ${v}`);
        return;
      }
    }
    console.log(`${indent}${key}: ${JSON.stringify(value)}`);
  } else if (Array.isArray(value)) {
    console.log(`${indent}${key}: [배열 ${value.length}개]`);
    value.forEach((item, i) => printValue(`[${i}]`, item, indent + '  '));
  } else if (value && typeof value === 'object') {
    console.log(`${indent}${key}:`);
    for (const [k, v] of Object.entries(value)) printValue(k, v, indent + '  ');
  } else {
    console.log(`${indent}${key}: ${JSON.stringify(value)}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.file) usageAndExit(args.help ? 0 : 1);

  const html = fs.readFileSync(args.file, 'utf8');
  const scriptBody = readScriptBody(html);
  const { markup, markers } = findWpMarkers(html);

  if (args.listWp) {
    if (markers.length === 0) {
      console.log('이 파일에 WP-XXX-000 형태의 화면ID가 없다.');
      return;
    }
    const seen = new Set();
    for (const mk of markers) {
      if (seen.has(mk.id)) continue;
      seen.add(mk.id);
      console.log(mk.id);
    }
    return;
  }

  if (!args.wp && !args.key) {
    console.error('--wp 또는 --key 중 하나는 필요하다. --list-wp로 이 파일의 화면ID 목록부터 봐라.');
    process.exit(1);
  }

  const resolved = evalRenderVals(scriptBody, args.file);

  let keys;
  if (args.key) {
    keys = [args.key];
  } else {
    keys = keysForWp(markup, markers, args.wp);
    if (keys === null) {
      console.error(`「${args.wp}」를 이 파일에서 못 찾았다. --list-wp로 실제 존재하는 ID를 확인해라.`);
      process.exit(1);
    }
    if (keys.length === 0) {
      console.error(`「${args.wp}」구역에 {{ }} 참조가 없다 — 정적 텍스트만 있는 화면일 수 있다.`);
      return;
    }
  }

  const out = {};
  for (const k of keys) {
    if (!(k in resolved)) {
      console.error(`(주의) renderVals()의 반환값에 「${k}」 키가 없다 — 지역 변수이거나 오타일 수 있다.`);
      continue;
    }
    out[k] = resolved[k];
  }

  if (args.json) {
    console.log(JSON.stringify(out, null, 2));
    return;
  }

  console.log(`# ${args.file}`);
  if (args.wp) console.log(`# ${args.wp}\n`);
  for (const [k, v] of Object.entries(out)) printValue(k, v);
}

main();
