#!/usr/bin/env node
/**
 * 코드에 적힌 **좌우 여백을 전수로 센다.**
 *
 * **왜 있는가.** 2026-09-15에 대표님이 「버튼 좌우 여백 불일치」를 찾으라고 하셨다.
 * 374군데에 흩어져 있어서 손으로 세면 반드시 빠뜨리고, 빠뜨린 자리는 다음 사람이
 * 고칠 근거를 잃는다. 그래서 센다.
 *
 *   node scripts/audit-horizontal-padding.mjs                # 전부
 *   node scripts/audit-horizontal-padding.mjs --only button  # 버튼처럼 생긴 것만
 *   node scripts/audit-horizontal-padding.mjs --json out.json
 *
 * **이 수는 기준이 아니다.** 최빈값이 정본이 되면 틀린 값이 다수결로 정본이 된다 —
 * 2026-09-14에 홈·검색·Pick이 통째로 피그마와 다른 채로 배포된 것이 그 결과다.
 * 기준값은 피그마에서 재고(`scripts/measure-edges.mjs --target figma`), 이 수는
 * **거기서 얼마나 어긋나 있는지**를 보는 데 쓴다(CLAUDE.md 최상위 정책 규칙 1번).
 */
import { readFile, writeFile } from 'node:fs/promises';
import { readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ROOTS = ['apps/mobile/src', 'packages/ui/src'];
const PROPS = ['paddingHorizontal', 'paddingLeft', 'paddingRight', 'paddingInline'];

/**
 * 스타일 이름이 이 중 하나를 품으면 그 갈래로 센다. 위에서부터 먼저 맞는 것을 쓴다 —
 * `chipButton`은 칩이지 버튼이 아니다.
 */
const KINDS = [
  ['chip', /chip|pill|segment|filter|option|tab(?!le)/i],
  ['tag', /\btag\b|badge/i],
  ['field', /input|field|textarea|search|select/i],
  ['button', /button|btn|cta|fab|action|submit|confirm/i],
  ['card', /card|sheet|modal|dialog|toast|banner|tile/i],
  ['row', /row|item|cell|list|entry/i],
  ['screen', /screen|page|container|content|body|wrap|scroll|section|header|footer|nav|bar/i],
];

function parseArgs(argv) {
  const opts = { only: null, json: null };

  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--only') opts.only = argv[++i];
    else if (argv[i] === '--json') opts.json = argv[++i];
    else throw new Error(`모르는 인자: ${argv[i]}`);
  }

  return opts;
}

function walkDir(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);

    if (name === 'node_modules' || name.startsWith('.')) continue;
    if (statSync(full).isDirectory()) walkDir(full, out);
    else if (['.ts', '.tsx'].includes(extname(full)) && !full.endsWith('.test.tsx') && !full.endsWith('.test.ts')) {
      out.push(full);
    }
  }

  return out;
}

/**
 * `Layout.gutter` 같은 이름을 수로 바꾼다. 이름만 세면 「gutter 164개」로 끝나고
 * **그 gutter가 몇 px인지**는 안 나온다 — 피그마와 견주려면 수여야 한다.
 */
async function loadTokens() {
  const src = await readFile(join(REPO, 'packages/ui/src/theme.ts'), 'utf8');
  const tokens = new Map();

  for (const [, name, body] of src.matchAll(/export const (\w+) = \{([\s\S]*?)\n\}/g)) {
    for (const [, key, value] of body.matchAll(/^\s{2}(\w+):\s*(-?\d+(?:\.\d+)?),/gm)) {
      tokens.set(`${name}.${key}`, Number(value));
    }
  }

  return tokens;
}

function kindOf(styleName) {
  for (const [kind, re] of KINDS) if (re.test(styleName)) return kind;

  return 'other';
}

/**
 * 한 파일에서 좌우 여백을 모두 꺼낸다.
 *
 * 스타일 이름은 **그 줄 위쪽에서 가장 가까운 `이름: {`** 로 잡는다. TypeScript를
 * 제대로 파싱하지 않는 대신 어느 스타일에 붙은 값인지를 놓치지 않는다 — 감사는
 * 값과 자리를 같이 적어야 쓸모가 있다.
 */
function scanFile(text, file, tokens) {
  const lines = text.split('\n');
  const hits = [];

  /* 파일 안에서만 쓰는 `const CHIP_PADDING_X = 14` 같은 이름도 수로 푼다. */
  const local = new Map(
    [...text.matchAll(/^const (\w+) = (-?\d+(?:\.\d+)?);/gm)].map(([, k, v]) => [k, Number(v)]),
  );

  for (let i = 0; i < lines.length; i += 1) {
    const m = new RegExp(`\\b(${PROPS.join('|')}):\\s*([^,\\n]+?)\\s*[,}]`).exec(lines[i]);

    if (!m) continue;

    const [, prop, rawValue] = m;
    /* `{ paddingHorizontal: Layout.gutter }` 처럼 닫는 괄호가 붙어 오는 줄을 다듬는다. */
    const raw = rawValue.trim().replace(/[}\)\s]+$/, '');
    const numeric = /^-?\d+(?:\.\d+)?$/.test(raw)
      ? Number(raw)
      : tokens.get(raw) ?? local.get(raw) ?? null;

    let styleName = '(이름 없음)';

    for (let j = i; j >= 0 && j > i - 60; j -= 1) {
      const owner = /^\s{0,4}(\w+):\s*\{\s*$/.exec(lines[j]);

      if (owner) {
        styleName = owner[1];
        break;
      }
    }

    hits.push({
      file,
      line: i + 1,
      prop,
      raw,
      value: numeric,
      styleName,
      kind: kindOf(styleName),
    });
  }

  return hits;
}

function report(hits, only) {
  const shown = only ? hits.filter((h) => h.kind === only) : hits;
  const lines = [
    `# 좌우 여백 전수 — ${shown.length}군데${only ? ` (${only}만)` : ''}`,
    '',
    '수는 **기준이 아니다.** 기준값은 피그마에서 잰다 — `scripts/measure-edges.mjs --target figma`.',
    '',
  ];

  const byKind = new Map();

  for (const h of shown) {
    if (!byKind.has(h.kind)) byKind.set(h.kind, []);
    byKind.get(h.kind).push(h);
  }

  for (const [kind, group] of [...byKind.entries()].sort((a, b) => b[1].length - a[1].length)) {
    const counts = new Map();

    for (const h of group) {
      const key = h.value === null ? `${h.raw} (수를 못 풀었다)` : `${h.value}px${h.raw === String(h.value) ? '' : ` ← ${h.raw}`}`;

      if (!counts.has(key)) counts.set(key, []);
      counts.get(key).push(h);
    }

    const sorted = [...counts.entries()].sort((a, b) => b[1].length - a[1].length);

    lines.push(`## ${kind} — ${group.length}군데 · 서로 다른 값 ${sorted.length}가지`);

    for (const [key, group_] of sorted) {
      lines.push(`  ${key} ×${group_.length}`);
      /* 값이 드문 것일수록 어긋난 자리다 — 다섯 이하면 자리를 다 적는다. */
      if (group_.length <= 5) {
        for (const h of group_) lines.push(`      ${h.file}:${h.line}  ${h.styleName}.${h.prop}`);
      }
    }

    lines.push('');
  }

  return lines.join('\n');
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const tokens = await loadTokens();
  const hits = [];

  for (const root of ROOTS) {
    for (const file of walkDir(join(REPO, root))) {
      hits.push(...scanFile(await readFile(file, 'utf8'), relative(REPO, file), tokens));
    }
  }

  process.stdout.write(`${report(hits, opts.only)}\n`);

  if (opts.json) {
    await writeFile(opts.json, `${JSON.stringify(hits, null, 2)}\n`);
    process.stderr.write(`${opts.json}에 적었다.\n`);
  }
}

main().catch((err) => {
  process.stderr.write(`${err.message}\n`);
  process.exit(1);
});
