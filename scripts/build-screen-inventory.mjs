#!/usr/bin/env node
/**
 * `docs/design/html/*.dc.html`에서 화면 목록과 「정본과 다른 점」 대조표를 뽑아
 * `docs/design/screen-inventory.md`를 만든다.
 *
 * **왜 필요한가.** `.dc.html`은 이 환경에서 렌더되지 않는다 — `_ds/`(SEED 번들)와
 * `support.js`가 v3.28 전달 ZIP에 없다(용량 이유, `docs/design/README.md`). 그래서
 * 화면을 보려면 소스 안의 텍스트를 읽어야 하는데, 각 파일이 스스로 화면을
 * `{{ tag }}`/`{{ tagId }}`/`{{ tagDesc }}` 세 자리로, 시안이 Figma 원본과 어떻게
 * 다른지를 `diff(...)`/`vdiff(...)` 함수 호출로 이미 구조화해서 담고 있다 —
 * 사람이 옮겨 적을 필요가 없다.
 *
 * 쓰는 법: `node scripts/build-screen-inventory.mjs`
 * (docs/design/screen-inventory.md를 덮어쓴다. 그 뒤 canonical-manifest.json의
 * derivedFiles.files[0].normalizedSha256·sizeBytes를 새 값으로 갱신한다.)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const HTML_DIR = join(ROOT, 'docs/design/html');

const FILES = [
  ['home', '대메뉴_홈(로그인, 온보딩).dc.html', '홈 · 로그인 · 온보딩'],
  ['search', '대메뉴_검색.dc.html', '검색 · 업체상세'],
  ['pick', '대메뉴_Pick.dc.html', 'Pick'],
  ['wedding', '대메뉴_웨딩노트.dc.html', '웨딩노트'],
  ['my', '대메뉴_MY.dc.html', 'MY'],
  ['legal', '웨딩픽 약관 방침.dc.html', '약관 방침(관리자 편집 도구)'],
];

/*
 * 화면 태그는 두 벌이다 — 검색·Pick 파일의 업체상세 화면군은 `{{ vtag }}`/`{{ vtagId }}`/
 * `{{ vtagDesc }}`를 쓴다. `tag`만 찾던 동안 검색 파일의 화면 8개(WP-VEND-001~008)가
 * 인벤토리에서 통째로 빠져 있었다 — README가 적은 「14개」와 목록의 4개가 그래서 어긋났다.
 */
const TAG_RE =
  /<div style="\{\{ v?tag \}\}"><span style="\{\{ v?tagId \}\}">([^<]*)<\/span>(?:<span style="\{\{ v?tagText \}\}">([^<]*)<\/span>|([^<]*))<\/div>\s*(?:<span style="\{\{ v?tagDesc \}\}">([^<]*)<\/span>)?/g;
const SECTION_RE =
  /padding:16px 0 0;font-size:22px;line-height:30px;font-weight:700;color:#212124">([^<]*)<\/div>/g;

const STR = "'((?:[^'\\\\]|\\\\.)*)'";
const CALL_RE = new RegExp(
  `\\b(v?diff)\\(\\s*${STR}\\s*,\\s*${STR}\\s*,\\s*${STR}\\s*,\\s*${STR}(?:\\s*,\\s*${STR})?\\s*\\)`,
  'g',
);

const unescape = (s) => s.replace(/\\'/g, "'").replace(/\\"/g, '"');

function extractScreens(src) {
  const events = [];
  for (const m of src.matchAll(SECTION_RE)) events.push([m.index, 'section', m[1].trim()]);
  for (const m of src.matchAll(TAG_RE)) {
    const num = m[1].trim();
    const titleLine = (m[2] || m[3] || '').trim();
    const desc = (m[4] || '').trim();
    events.push([m.index, 'screen', { num, titleLine, desc }]);
  }
  events.sort((a, b) => a[0] - b[0]);

  const out = [];
  let section = null;
  for (const [, kind, val] of events) {
    if (kind === 'section') section = val;
    else {
      const wpMatch = val.titleLine.match(/WP-[A-Z]+-\d+/);
      out.push({
        section,
        num: val.num,
        wpId: wpMatch ? wpMatch[0] : null,
        title: val.titleLine.split('·')[0]?.trim() || val.titleLine,
        desc: val.desc,
      });
    }
  }
  return out;
}

/**
 * **표마다 열 순서가 다르다 — 머리글을 읽어서 정한다.**
 *
 * 다섯 파일은 「항목 · Figma 원본 · 정본 · 근거」 순인데, 검색 파일의 둘째 표
 * (`diffHead`, 화면 14 「검색 · 정본과 다른 점」)만 「항목 · **정본** · **Figma** · 판단」으로
 * 뒤집혀 있다. 함수 이름(`diff`/`vdiff`)으로는 구분되지 않는다 — 같은 `diff()`가 홈 파일에선
 * Figma 먼저고 검색 파일에선 정본 먼저다.
 *
 * 그 표를 다른 표와 같은 순서로 읽던 동안 검색 13건이 정본과 Figma를 맞바꾼 채 실려 있었다 —
 * 「제목: 정본=업체 탐색」처럼 금지어가 정본으로 뒤집히고, 「스타일: 정본=미니멀·클래식」처럼
 * `WeddingStyle` 네 값과 어긋났다. 답안지가 답을 반대로 적고 있었다.
 */
const HEAD_RE = /<div style="\{\{ (v?)diffHead \}\}">([\s\S]*?)<\/div>/g;

/** 파일 안 두 표의 열 순서. `true`면 둘째 인자가 Figma 값이다(기본값). */
function figmaFirstByTable(src) {
  const out = { vdiff: true, diff: true };
  for (const m of src.matchAll(HEAD_RE)) {
    const labels = [...m[2].matchAll(/\{\{ \w+ \}\}">([^<]*)<\/span>/g)].map((h) => h[1].trim());
    out[m[1] === 'v' ? 'vdiff' : 'diff'] = (labels[1] ?? '').startsWith('Figma');
  }
  return out;
}

function extractDiffs(src) {
  const figmaFirst = figmaFirstByTable(src);
  const out = [];
  for (const m of src.matchAll(CALL_RE)) {
    const [, fn, k, a, b, why, kind] = m;
    const [figma, canon] = figmaFirst[fn] ? [a, b] : [b, a];
    out.push({ fn, item: unescape(k), figma: unescape(figma), canon: unescape(canon), reason: unescape(why), kind });
  }
  return out;
}

const lines = [];
lines.push('# v3.28 화면 인벤토리 · Figma ↔ 정본 대조표\n');
lines.push('`docs/design/html/*.dc.html`에서 기계로 뽑았다(`scripts/build-screen-inventory.mjs`). 화면 태그');
lines.push('(`{{ tag }}`/`{{ tagId }}`/`{{ tagDesc }}`)와 각 파일 안 「정본과 다른 점」 표(`diff()`/`vdiff()` 호출)를');
lines.push('파싱했다 — 사람이 옮겨 적은 것이 아니다.\n');
lines.push('**`.dc.html`은 이 환경에서 렌더되지 않는다.** `_ds/`(SEED 번들)와 `support.js`가 v3.28 전달 ZIP에');
lines.push('없어서(용량 이유, `docs/design/README.md`) 브라우저로 열어도 빈 틀만 보인다. 이 문서는 그 대신');
lines.push('소스 안의 태그·설명·대조표 텍스트를 그대로 옮긴 것이다.\n');
lines.push('**열 순서는 파일마다 다른 것을 맞춰 실었다.** 검색 파일의 둘째 표만 소스에서');
lines.push('「항목 · 정본 · Figma · 판단」 순으로 뒤집혀 있어, 여기서는 다른 표와 같은 순서로 돌려놓았다.\n');
lines.push('| 표시 | 뜻 |');
lines.push('| --- | --- |');
lines.push('| (표시 없음) | 이미 v3.28 시안에 반영됨 — 구현이 이 값을 따라야 한다 |');
lines.push('| `[warn]` | 시안엔 반영했지만 재검토 여지가 있다고 적어 둠 |');
lines.push('| `[bad]` | 옛 코드/Figma가 실제로 규칙을 어기고 있던 자리 — 구현에서 특히 확인 |');
lines.push('| `[open]` | **정책 결정 대기.** 시안에 답이 없다 — 대표님 판단 없이 구현하지 않는다 |\n');

const allScreens = [];
const allDiffs = [];
for (const [key, filename] of FILES) {
  const src = readFileSync(join(HTML_DIR, filename), 'utf8');
  const screens = extractScreens(src).map((s) => ({ ...s, file: key }));
  const diffs = extractDiffs(src).map((d) => ({ ...d, file: key }));
  allScreens.push(...screens);
  allDiffs.push(...diffs);
}

const namedScreens = allScreens.filter((s) => s.wpId);
const openCount = allDiffs.filter((d) => d.kind === 'open').length;
lines.push(
  `**요약**: 화면 태그 ${namedScreens.length}개 · 대조표 ${allDiffs.length}건 · 정책 결정 대기 ${openCount}건.\n`,
);

for (const [key, filename, label] of FILES) {
  lines.push(`\n## ${label} — \`${filename}\`\n`);

  const screens = allScreens.filter((s) => s.file === key && s.wpId);
  if (screens.length > 0) {
    lines.push('### 화면 목록\n');
    lines.push('| # | WP-ID | 제목 | 설명 |');
    lines.push('| --- | --- | --- | --- |');
    for (const s of screens) {
      const desc = s.desc.length > 120 ? `${s.desc.slice(0, 120)}…` : s.desc;
      lines.push(`| ${s.num} | \`${s.wpId}\` | ${s.title} | ${desc} |`);
    }
    lines.push('');
  } else {
    lines.push('_화면 태그 없음 — 관리자 편집 도구 화면만 있다._\n');
  }

  const diffs = allDiffs.filter((d) => d.file === key);
  if (diffs.length > 0) {
    lines.push('### Figma 원본 ↔ 정본 대조\n');
    lines.push('| 항목 | Figma 원본 | 정본(v3.28) | 근거 |');
    lines.push('| --- | --- | --- | --- |');
    for (const d of diffs) {
      const mark = d.kind ? ` \`[${d.kind}]\`` : '';
      lines.push(`| ${d.item}${mark} | ${d.figma} | ${d.canon} | ${d.reason} |`);
    }
    lines.push('');
  }
}

lines.push('\n## 정책 결정 대기 (`[open]`) — 대표님 확인 필요\n');
for (const [key, , label] of FILES) {
  for (const d of allDiffs.filter((x) => x.file === key && x.kind === 'open')) {
    lines.push(`- **${label} · ${d.item}**: Figma=«${d.figma}» / 정본=«${d.canon}» — ${d.reason}`);
  }
}

const outPath = join(ROOT, 'docs/design/screen-inventory.md');
writeFileSync(outPath, `${lines.join('\n')}\n`, 'utf8');
console.log(
  `${outPath} 작성: 화면 ${namedScreens.length}개 · 대조 ${allDiffs.length}건 · 정책 결정 대기 ${openCount}건`,
);
