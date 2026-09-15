#!/usr/bin/env node
/**
 * **피그마 규격서와 우리 토큰을 나란히 센다.**
 *
 * **왜 있는가.** 2026-09-15에 대표님이 UI 규격화를 지시하시며 「우리 코드의 값을 전수
 * 조사해 사용 빈도로 통합 후보를 정한다」는 방식을 주셨다. 그대로 하면 안 되는 자리가
 * 있다 — 최상위 정책 규칙 1번이 「모든 디자인은 피그마 기준」이라, 우리 코드의 다수결로
 * 기준을 정하면 **틀린 값이 다수결로 정본이 된다.** 2026-09-14에 홈·검색·Pick이 통째로
 * 피그마와 다른 채로 배포된 것이 그 결과다.
 *
 * 그래서 순서를 뒤집는다. **왼쪽이 피그마(기준), 오른쪽이 우리 코드(현황)** 이고, 이
 * 스크립트가 내는 것은 「무엇이 정본인가」가 아니라 **「얼마나 어긋나 있는가」**다.
 *
 *   node scripts/audit-design-tokens.mjs                  # 전부
 *   node scripts/audit-design-tokens.mjs --group color
 *   node scripts/audit-design-tokens.mjs --json out.json
 *
 * 피그마 쪽 입력은 `docs/figma-spec/*.json`이다(노드 1,015개). 없거나 낡았으면
 * `node scripts/extract-figma-spec.mjs --out docs/figma-spec`로 다시 뽑는다.
 */
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, dirname, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FIGMA_SPEC = join(REPO, 'docs/figma-spec');
const CODE_ROOTS = ['apps/mobile/src', 'packages/ui/src'];

/** 세는 갈래. 각 갈래는 피그마 노드에서 값을 꺼내는 법과 코드에서 찾는 법을 함께 안다. */
const GROUPS = ['color', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'radius', 'gap', 'padding', 'iconSize'];

function parseArgs(argv) {
  const opts = { group: null, json: null };

  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--group') opts.group = argv[++i];
    else if (argv[i] === '--json') opts.json = argv[++i];
    else throw new Error(`모르는 인자: ${argv[i]}`);
  }

  if (opts.group && !GROUPS.includes(opts.group)) {
    throw new Error(`--group은 이 중 하나다: ${GROUPS.join(' · ')}`);
  }

  return opts;
}

function bump(map, key, where) {
  if (key === undefined || key === null || key === '') return;
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(where);
}

/** 피그마 규격서 전체를 갈래별로 센다. 이것이 **기준값**이다. */
async function tallyFigma() {
  const tally = Object.fromEntries(GROUPS.map((g) => [g, new Map()]));
  let nodes = 0;

  for (const name of await readdir(FIGMA_SPEC)) {
    if (extname(name) !== '.json') continue;

    const screen = basename(name, '.json');

    for (const n of JSON.parse(await readFile(join(FIGMA_SPEC, name), 'utf8'))) {
      nodes += 1;

      if (n.color) bump(tally.color, n.color, screen);
      if (n.background) bump(tally.color, n.background, screen);
      if (n.border) bump(tally.color, n.border.split(' ').slice(1).join(' '), screen);

      if (n.font) {
        const [size, weight] = n.font.split('/');

        bump(tally.fontSize, Number(size), screen);
        bump(tally.fontWeight, Number(weight), screen);
      }

      if (n.lineHeight) bump(tally.lineHeight, n.lineHeight, screen);
      if (n.letterSpacing) bump(tally.letterSpacing, n.letterSpacing, screen);
      if (n.radius) bump(tally.radius, n.radius, screen);
      if (n.gap) bump(tally.gap, n.gap, screen);

      /* 패딩·마진은 네 값을 따로 센다 — 「16 16 16 16」을 한 값으로 세면 사다리가 안 보인다. */
      for (const key of ['padding', 'margin']) {
        if (!n[key]) continue;
        for (const v of n[key].split(' ').map(Number)) if (v) bump(tally.padding, v, screen);
      }

      /* 아이콘은 svg 노드의 실제 크기다. 정사각이 아니면 둘 다 적는다. */
      if (n.icon) bump(tally.iconSize, n.w === n.h ? n.w : `${n.w}×${n.h}`, screen);
    }
  }

  return { tally, nodes };
}

function walkDir(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);

    if (name === 'node_modules' || name.startsWith('.')) continue;
    if (statSync(full).isDirectory()) walkDir(full, out);
    else if (['.ts', '.tsx'].includes(extname(full)) && !/\.test\.tsx?$/.test(full)) out.push(full);
  }

  return out;
}

/**
 * 우리 코드를 같은 갈래로 센다.
 *
 * **토큰을 거치지 않고 화면에 직접 적힌 값**을 찾는 것이 목적이다 — 최상위 규칙 1번이
 * 「화면 코드에 hex·px를 직접 적지 않는다」이므로, 여기 걸리는 것은 그 자체로 위반이다.
 */
async function tallyCode() {
  const tally = Object.fromEntries(GROUPS.map((g) => [g, new Map()]));
  const PATTERNS = [
    [/#[0-9a-fA-F]{6}\b/g, 'color', (m) => m.toUpperCase()],
    [/\bfontSize:\s*(\d+(?:\.\d+)?)/g, 'fontSize', (_, v) => Number(v)],
    [/\bfontWeight:\s*'(\d+)'/g, 'fontWeight', (_, v) => Number(v)],
    [/\blineHeight:\s*(\d+(?:\.\d+)?)/g, 'lineHeight', (_, v) => Number(v)],
    [/\bletterSpacing:\s*(-?\d+(?:\.\d+)?)/g, 'letterSpacing', (_, v) => Number(v)],
    [/\bborderRadius:\s*(\d+(?:\.\d+)?)/g, 'radius', (_, v) => Number(v)],
    [/\bgap:\s*(\d+(?:\.\d+)?)/g, 'gap', (_, v) => Number(v)],
    [/\bpadding(?:Horizontal|Vertical|Top|Right|Bottom|Left)?:\s*(\d+(?:\.\d+)?)/g, 'padding', (_, v) => Number(v)],
    [/\bsize=\{(\d+)\}/g, 'iconSize', (_, v) => Number(v)],
  ];

  for (const root of CODE_ROOTS) {
    for (const file of walkDir(join(REPO, root))) {
      const text = await readFile(file, 'utf8');
      const where = relative(REPO, file);

      for (const [re, group, pick] of PATTERNS) {
        for (const m of text.matchAll(re)) bump(tally[group], pick(m[0], m[1]), where);
      }
    }
  }

  return tally;
}

/**
 * 우리 토큰 정본이 든 값들.
 *
 * **이것을 같이 읽지 않으면 비교가 거짓말을 한다.** 우리 화면은 `fontSize: 12`라고
 * 적지 않고 `FontSize.tab`을 쓰므로(그것이 규칙이다), 코드 문자열만 세면 피그마의
 * 크기가 전부 「피그마에만 있다」로 나온다 — 실제로 한 번 그렇게 나왔고 하마터면
 * 없는 결함을 보고할 뻔했다. 토큰이 든 값까지 세야 **정말로 없는 값**이 드러난다.
 */
async function loadTokenValues() {
  const raw = await readFile(join(REPO, 'spec/tokens.json'), 'utf8');
  const numbers = new Set();
  const colors = new Set();

  for (const [, v] of raw.matchAll(/"value":\s*(-?\d+(?:\.\d+)?)/g)) numbers.add(Number(v));
  for (const [, v] of raw.matchAll(/:\s*(-?\d+(?:\.\d+)?)[,\n]/g)) numbers.add(Number(v));
  for (const m of raw.matchAll(/#[0-9a-fA-F]{6}\b/g)) colors.add(m[0].toUpperCase());

  /* 갈래별 사다리 — 화면이 고를 수 있는 값이 정확히 이것뿐이다. */
  const ladder = { fontSize: new Set(), lineHeight: new Set(), radius: new Set(), padding: new Set(), gap: new Set() };
  const pick = (src, block, into) => {
    const m = new RegExp(`export const ${block} = \\{([\\s\\S]*?)\\n\\}`).exec(src);

    if (m) for (const [, v] of m[1].matchAll(/^\s{2}\w+:\s*(\d+(?:\.\d+)?),/gm)) into.add(Number(v));
  };

  const typo = await readFile(join(REPO, 'packages/ui/src/typography.ts'), 'utf8');
  const theme = await readFile(join(REPO, 'packages/ui/src/theme.ts'), 'utf8');

  pick(typo, 'FontSize', ladder.fontSize);
  pick(typo, 'LineHeight', ladder.lineHeight);
  pick(theme, 'Radius', ladder.radius);
  pick(theme, 'Layout', ladder.padding);
  pick(theme, 'Spacing', ladder.padding);
  pick(theme, 'Layout', ladder.gap);
  pick(theme, 'Spacing', ladder.gap);

  return { numbers, colors, ladder };
}

function line(value, figma, code) {
  const f = figma?.length ?? 0;
  const c = code?.length ?? 0;
  const screens = figma ? [...new Set(figma)].length : 0;
  const mark = f > 0 && c === 0 ? '피그마에만' : f === 0 && c > 0 ? '우리에게만' : '둘 다';

  return { value, figma: f, code: c, screens, mark };
}

function report(figmaTally, codeTally, tokens, nodes, only) {
  const out = [
    '# 디자인 값 전수 — 피그마(기준) 대 우리 코드(현황)',
    '',
    `피그마 노드 ${nodes}개 · \`docs/figma-spec/*.json\``,
    '',
    '**왼쪽이 기준이다.** 우리 코드의 최빈값이 정본이 되는 것이 아니다(최상위 정책 규칙 1번).',
    '「우리에게만」은 피그마에 없는 값이고, 화면 코드에 직접 적혀 있으면 그 자체로 규칙 위반이다.',
    '',
  ];

  for (const group of GROUPS) {
    if (only && group !== only) continue;

    const keys = new Set([...figmaTally[group].keys(), ...codeTally[group].keys()]);
    const rows = [...keys]
      .map((k) => line(k, figmaTally[group].get(k), codeTally[group].get(k)))
      .sort((a, b) => b.figma - a.figma || b.code - a.code);

    const onlyOurs = rows.filter((r) => r.mark === '우리에게만');
    const onlyFigma = rows.filter((r) => r.mark === '피그마에만');

    out.push(`## ${group} — 값 ${rows.length}가지 (피그마 ${rows.length - onlyOurs.length} · 우리만 ${onlyOurs.length})`);
    out.push('');
    out.push('| 값 | 피그마 | 우리 코드 | 우리 토큰 | 쓰인 화면 |');
    out.push('| --- | ---: | ---: | --- | ---: |');

    for (const r of rows.slice(0, 24)) {
      const known = group === 'color'
        ? tokens.colors.has(String(r.value))
        : (tokens.ladder[group]?.has(Number(r.value)) ?? tokens.numbers.has(Number(r.value)));

      out.push(
        `| \`${r.value}\` | ${r.figma || '·'} | ${r.code || '·'} | ${known ? '있음' : '**없음**'} | ${r.screens || '·'} |`,
      );
    }

    if (rows.length > 24) out.push(`| … | | | | 그리고 ${rows.length - 24}가지 더 |`);

    out.push('');

    /* 정말로 없는 값 — 피그마가 쓰는데 우리 토큰 사다리에 없는 것. 여기가 고칠 자리다. */
    const missing = rows.filter((r) => {
      if (r.figma === 0) return false;

      return group === 'color'
        ? !tokens.colors.has(String(r.value))
        : !(tokens.ladder[group]?.has(Number(r.value)) ?? tokens.numbers.has(Number(r.value)));
    });

    if (missing.length) {
      out.push(`**피그마가 쓰는데 우리 토큰에 없는 값 ${missing.length}가지** (쓰인 횟수 순): ` +
        missing.slice(0, 20).map((r) => `\`${r.value}\`×${r.figma}`).join(' · ') +
        (missing.length > 20 ? ` … 외 ${missing.length - 20}` : ''));
      out.push('');
    }
  }

  return out.join('\n');
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const { tally: figmaTally, nodes } = await tallyFigma();
  const codeTally = await tallyCode();
  const tokens = await loadTokenValues();

  process.stdout.write(`${report(figmaTally, codeTally, tokens, nodes, opts.group)}\n`);

  if (opts.json) {
    const dump = Object.fromEntries(
      GROUPS.map((g) => [
        g,
        [...new Set([...figmaTally[g].keys(), ...codeTally[g].keys()])]
          .map((k) => line(k, figmaTally[g].get(k), codeTally[g].get(k))),
      ]),
    );

    await writeFile(opts.json, `${JSON.stringify(dump, null, 2)}\n`);
    process.stderr.write(`${opts.json}에 적었다.\n`);
  }
}

main().catch((err) => {
  process.stderr.write(`${err.message}\n`);
  process.exit(1);
});
