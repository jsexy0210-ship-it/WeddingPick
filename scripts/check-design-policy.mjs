#!/usr/bin/env node
/**
 * 최상위 정책 규칙(CLAUDE.md 맨 위) 가운데 **자동으로 잴 수 있는 것**을 잰다.
 *
 * 2026-09-14에 대표님이 앱을 열어 보시고 「피그마랑 아예 다르잖아」라고 하셨다. 그때까지
 * 세션 여럿이 「시안대로 맞췄다」고 보고했고 아무도 거짓말을 하지 않았다 — 두 화면을
 * 나란히 놓고 본 적이 없었을 뿐이다. 사람이 매번 세는 것은 언젠가 빠진다. 그래서 센다.
 *
 * 재는 것은 다섯이다.
 *
 *   R1      화면 코드에 hex를 직접 적지 않는다. 값은 SEED → spec/tokens.json → theme으로 온다.
 *   R1-아이콘 우리가 만든 선 아이콘(`CategoryIcon`)을 화면에 그리지 않는다. 피그마에 없다.
 *   R2      Pretendard만 쓴다. Noto Sans KR · Playfair Display · DM Mono는 코드에 없어야 한다.
 *   R5      로더 · 토스트 · 얼럿 · 컨펌은 색만 바꾼다 — 그 파일들에 생색이 있으면 안 된다.
 *   숫자    천단위 쉼표. `toLocaleString()`을 로케일 없이 부르지 않는다 — `comma()`를 거친다.
 *
 * **주석은 세지 않는다.** 이것이 이 스크립트의 핵심이다. 단순 grep은 `circle-loader.tsx`를
 * 위반 3건으로 잡는데, 그 셋은 전부 「시안의 #eaebee와 같은 값」이라고 적어 둔 주석이고
 * 코드는 `theme.line`만 쓴다. 근거를 적어 둔 것을 위반으로 세면 다음 사람은 근거를 지운다.
 *
 * **서드파티 브랜드 마크는 세지 않는다.** 구글 블루 `#4285F4` · 카카오 `#191919` ·
 * 네이버 `#03C75A`는 SEED 토큰이 될 수 없는 값이다 — 남의 브랜드 색이라 우리가 정하지
 * 않는다. ALLOWLIST에 파일 단위로 적고 이유를 남긴다.
 *
 * 남은 빚은 `design-policy-baseline.json`에 수로 적어 둔다. 스크립트는 **늘어나면** 깨진다.
 * 한 번에 다 고칠 수 없는 것을 0으로 적으면 다음 사람이 스크립트를 끈다.
 *
 *   node scripts/check-design-policy.mjs            잰다
 *   node scripts/check-design-policy.mjs --update   baseline을 지금 값으로 다시 적는다
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = join(ROOT, 'scripts', 'design-policy-baseline.json');

/** 화면 코드가 사는 자리. 여기에 hex가 있으면 R1 위반이다. */
const SCREEN_ROOTS = ['apps/mobile/src', 'packages/ui/src'];

/**
 * hex를 들고 있어도 되는 파일.
 *
 * 값이 **사는 자리**이거나, 값을 우리가 정하지 않는 자리다. 새로 더할 때는 둘 중
 * 어느 쪽인지를 적는다 — 「고치기 귀찮아서」는 이유가 아니다.
 */
const ALLOWLIST = new Map([
  ['packages/ui/src/theme.ts', '팔레트가 사는 자리. SEED에서 뽑은 값이 여기 담긴다'],
  ['packages/ui/src/design-tokens.ts', '핸드오프 토큰 스냅샷. 값이 사는 자리다'],
  ['packages/ui/src/tokens.css', '웹 CSS 변수가 사는 자리'],
  ['packages/ui/src/social-logo.tsx', '남의 브랜드 마크 — 구글 블루 · 카카오 · 애플. 우리가 정하는 값이 아니다'],
  ['packages/ui/src/npay-logo.tsx', '남의 브랜드 마크 — 네이버 그린 #03C75A'],
  ['apps/mobile/src/app/admin/og-card.tsx', 'OG 이미지를 SVG 문자열로 그린다 — theme을 태울 수 없다'],
]);

/** R2 — 이 서체들이 코드에 있으면 걸린다. 피그마 fonts.css가 불러도 따라가지 않는다. */
const FORBIDDEN_FONTS = ['Noto Sans KR', 'Playfair Display', 'DM Mono'];

/** R5 — 색만 바꾸는 컴포넌트. 생색이 있으면 색이 토큰 밖에서 온 것이다. */
const GUARDED = [
  'packages/ui/src/circle-loader.tsx',
  'packages/ui/src/category-cycle-loader.tsx',
  'packages/ui/src/toast.tsx',
  'packages/ui/src/show-alert.ts',
];

/**
 * R1-아이콘 — 우리가 만든 선 아이콘은 화면에 그리지 않는다.
 *
 * 2026-09-15 대표 지시: 「전체 이모지 SEED 걸로 사용한다. 선 아이콘 X」. 피그마가 이모지를
 * 그린 자리(카테고리 · 준비현황)는 이모지, SEED 아이콘을 쓴 자리(탭 바 · 헤더 · 상태)는
 * SEED다. `CategoryIcon`은 **피그마에 없는 우리 것**이라 화면에서 쓰지 않는다.
 *
 * 앞 세션이 실제로 이것을 선 아이콘으로 바꿨다가 되돌렸다. 되돌린 것이 또 뒤집히지 않게 센다.
 *
 * **`CategoryCycleLoader`만 예외다.** 업종 아이콘이 도는 로더 자체가 피그마에 없는
 * 우리 것이고, R5가 「기존 정본을 그대로 쓰되 색만 바꾼다」로 이미 지키는 자리다 —
 * 여기서 아이콘을 바꾸는 것은 R5 위반이 된다. 규칙 둘이 반대로 당기므로 자리를 적어 둔다.
 */
const LINE_ICON_ALLOWED = 'packages/ui/src/category-cycle-loader.tsx';
const LINE_ICON_RENDER = /<CategoryIcon\b/g;

/**
 * 숫자 — 천단위 쉼표. 로케일을 빼고 부르면 걸린다.
 *
 * 2026-09-15 대표 지시 「항상 모든 숫자는 천단위 [,] 처리한다」. `toLocaleString()`을
 * 로케일 없이 부르면 기기 설정을 따라가고, **독일어 기기에서 `1,234`가 `1.234`가 된다** —
 * 천을 나타내는 쉼표가 소수점으로 읽힌다. 우리 기기에서는 재현되지 않고 오류도 나지
 * 않아서, 사람이 보는 것으로는 절대 안 잡힌다. 그래서 센다.
 *
 * 고치는 법은 `comma()`(`@weddingpick/domain` `korean.ts`)를 거치는 것이다.
 */
const LOCALELESS_NUMBER = /\.toLocaleString\(\s*\)/g;

/** 숫자는 화면 밖에서도 만들어진다 — 웹 문자열 · domain 문구까지 훑는다. */
const NUMBER_ROOTS = ['apps/mobile/src', 'packages/ui/src', 'apps/web/src', 'packages/domain/src'];

/**
 * 주석과 문자열을 걷어낸다.
 *
 * 정규식 한 줄로는 안 된다 — `'https://…'` 안의 `//`가 주석으로 읽히고, 주석 안의
 * 따옴표가 문자열을 연다. 한 글자씩 본다.
 *
 * 문자열도 같이 걷어내는 이유는, 남은 hex가 **스타일 값으로 쓰인 것**만이기를
 * 바라서가 아니다. 그 반대다 — `color: '#FF6F61'`처럼 문자열 안에 있는 것이 진짜
 * 위반이다. 그래서 문자열은 **지우지 않고 내용만 남긴다**(따옴표만 없앤다).
 */
function stripComments(source) {
  let out = '';
  let i = 0;
  const n = source.length;
  let quote = null; // 여는 따옴표 문자
  let inLine = false;
  let inBlock = false;

  while (i < n) {
    const c = source[i];
    const next = source[i + 1];

    if (inLine) {
      if (c === '\n') {
        inLine = false;
        out += c;
      } else {
        out += ' ';
      }
      i += 1;
      continue;
    }

    if (inBlock) {
      if (c === '*' && next === '/') {
        inBlock = false;
        out += '  ';
        i += 2;
      } else {
        out += c === '\n' ? '\n' : ' ';
        i += 1;
      }
      continue;
    }

    if (quote) {
      if (c === '\\') {
        out += '  ';
        i += 2;
        continue;
      }
      if (c === quote) {
        quote = null;
        out += ' ';
        i += 1;
        continue;
      }
      // 문자열 내용은 남긴다 — 위반이 여기 산다.
      out += c;
      i += 1;
      continue;
    }

    if (c === '/' && next === '/') {
      inLine = true;
      i += 2;
      continue;
    }
    if (c === '/' && next === '*') {
      inBlock = true;
      i += 2;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      quote = c;
      out += ' ';
      i += 1;
      continue;
    }

    out += c;
    i += 1;
  }

  return out;
}

function walk(dir, acc = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return acc;
  }
  for (const entry of entries) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, acc);
    // 시험은 값을 직접 적는 자리다 — 「이 색이 나와야 한다」를 토큰으로 적으면
    // 토큰이 틀렸을 때 시험도 같이 틀려서 아무것도 못 잡는다.
    else if (/\.(test|spec)\.(ts|tsx)$/.test(entry)) continue;
    else if (/\.(ts|tsx|css)$/.test(entry)) acc.push(full);
  }
  return acc;
}

const HEX = /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g;

function lineOf(source, index) {
  return source.slice(0, index).split('\n').length;
}

function collect() {
  const findings = { r1: [], r2: [], r5: [], icon: [], number: [] };

  for (const root of SCREEN_ROOTS) {
    for (const file of walk(join(ROOT, root))) {
      const rel = relative(ROOT, file).split('\\').join('/');
      const raw = readFileSync(file, 'utf8');
      const code = stripComments(raw);

      // R1 — 화면 코드의 생 hex
      if (!ALLOWLIST.has(rel)) {
        for (const m of code.matchAll(HEX)) {
          findings.r1.push({ file: rel, line: lineOf(code, m.index), value: m[0] });
        }
      }

      // R2 — 금지 서체. 주석에 「쓰지 않는다」고 적은 것은 세지 않는다.
      for (const font of FORBIDDEN_FONTS) {
        let at = code.indexOf(font);
        while (at !== -1) {
          findings.r2.push({ file: rel, line: lineOf(code, at), value: font });
          at = code.indexOf(font, at + 1);
        }
      }

      // R5 — 색만 바꾸는 컴포넌트에 생색
      if (GUARDED.includes(rel)) {
        for (const m of code.matchAll(HEX)) {
          findings.r5.push({ file: rel, line: lineOf(code, m.index), value: m[0] });
        }
      }

      // R1-아이콘 — 화면이 우리 선 아이콘을 그리는가
      if (rel !== LINE_ICON_ALLOWED) {
        for (const m of code.matchAll(LINE_ICON_RENDER)) {
          findings.icon.push({ file: rel, line: lineOf(code, m.index), value: '<CategoryIcon>' });
        }
      }
    }
  }

  /*
   * 숫자는 화면 코드 밖에서도 만들어진다 — 웹의 문자열 템플릿 · domain의 문구.
   * 그래서 이 하나만 더 넓게 훑는다.
   */
  for (const root of NUMBER_ROOTS) {
    for (const file of walk(join(ROOT, root))) {
      const rel = relative(ROOT, file).split('\\').join('/');
      const code = stripComments(readFileSync(file, 'utf8'));
      for (const m of code.matchAll(LOCALELESS_NUMBER)) {
        findings.number.push({ file: rel, line: lineOf(code, m.index), value: 'toLocaleString()' });
      }
    }
  }

  return findings;
}

/** R2 — 토큰의 서체 스택은 Pretendard로 시작해야 한다. */
function checkFontStacks() {
  const problems = [];
  const tokens = JSON.parse(readFileSync(join(ROOT, 'spec/tokens.json'), 'utf8'));
  const stacks = tokens?.typography?.$fontFamily ?? {};
  for (const platform of ['ios', 'android', 'web']) {
    const stack = stacks[platform];
    if (typeof stack !== 'string') {
      problems.push(`spec/tokens.json typography.$fontFamily.${platform} 이 없다`);
      continue;
    }
    const first = stack.split(',')[0].replace(/['"]/g, '').trim();
    if (!/^Pretendard/.test(first)) {
      problems.push(`spec/tokens.json ${platform} 스택의 맨 앞이 Pretendard가 아니다 — ${first}`);
    }
    for (const font of FORBIDDEN_FONTS) {
      if (stack.includes(font)) problems.push(`spec/tokens.json ${platform} 스택에 ${font}가 있다`);
    }
  }
  return problems;
}

const findings = collect();
const stackProblems = checkFontStacks();

const counts = {
  r1_hex_in_screen_code: findings.r1.length,
  r2_forbidden_fonts: findings.r2.length + stackProblems.length,
  r5_raw_color_in_guarded: findings.r5.length,
  icon_line_icon_in_screens: findings.icon.length,
  number_localeless_tolocalestring: findings.number.length,
};

if (process.argv.includes('--update')) {
  writeFileSync(
    BASELINE,
    `${JSON.stringify(
      {
        $note:
          '최상위 정책 규칙의 남은 빚. scripts/check-design-policy.mjs가 읽는다. ' +
          '늘어나면 깨진다 — 줄었으면 --update로 다시 적어 조인다.',
        updated: new Date().toISOString().slice(0, 10),
        counts,
      },
      null,
      2
    )}\n`
  );
  console.log('baseline을 다시 적었다:', counts);
  process.exit(0);
}

let baseline;
try {
  baseline = JSON.parse(readFileSync(BASELINE, 'utf8')).counts;
} catch {
  console.error(`baseline이 없다. 먼저 --update로 만든다: ${relative(ROOT, BASELINE)}`);
  process.exit(1);
}

let failed = false;
const show = { r1: findings.r1, r2: findings.r2, r5: findings.r5, icon: findings.icon, number: findings.number };

for (const [key, count] of Object.entries(counts)) {
  const allowed = baseline[key] ?? 0;
  const mark = count > allowed ? 'FAIL' : count < allowed ? 'DOWN' : 'ok';
  console.log(`${mark.padEnd(4)} ${key}: ${count} (baseline ${allowed})`);
  if (count > allowed) failed = true;
}

if (stackProblems.length) {
  console.log('\n서체 스택:');
  for (const p of stackProblems) console.log(`  - ${p}`);
}

if (failed) {
  console.log('\n늘어난 자리:');
  for (const [key, list] of Object.entries(show)) {
    if (!list.length) continue;
    console.log(`\n[${key}]`);
    for (const f of list.slice(0, 40)) console.log(`  ${f.file}:${f.line}  ${f.value}`);
    if (list.length > 40) console.log(`  … 그리고 ${list.length - 40}건 더`);
  }
  console.log('\n최상위 정책 규칙을 어겼다. CLAUDE.md 맨 위를 보라.');
  process.exit(1);
}

console.log('\n최상위 정책 규칙 — 자동으로 재는 다섯은 baseline 아래다.');
