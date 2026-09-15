#!/usr/bin/env node
/**
 * SEED 디자인 시스템의 **컴포넌트 규격**을 뽑아서 `spec/seed-components.json`에 적는다.
 *
 * **왜 있는가.** `sync-seed-tokens.mjs`가 색을 뽑는 것과 같은 이유다 — 손으로 베끼면
 * 반드시 다시 갈라진다. 색은 2026-09-15에 실제로 갈라져 있었고(본문 먹색 `#212124` vs
 * SEED 현행 `#1A1C20`) 아무도 몰랐다. 크기 · 여백 · 곡률도 똑같이 갈라진다.
 *
 * **`@seed-design/css`가 아니라 `@seed-design/rootage-artifacts`에서 뽑는다.** SEED에
 * React Native 판이 없다는 사정은 그대로지만(sync-seed-tokens.mjs:10), rootage는 웹 CSS가
 * 아니라 **순수 JSON**이라 RN에서도 값을 그대로 읽을 수 있다. 「one token source delivering
 * consistent design across React, iOS, Android, Lynx」의 그 source다.
 *
 *   node scripts/sync-seed-components.mjs           # spec/seed-components.json을 새로 쓴다
 *   node scripts/sync-seed-components.mjs --check   # 어긋나면 빨개진다(CI용)
 *
 * **색은 뽑지 않는다.** 색은 `sync-seed-tokens.mjs` → `spec/seed-tokens.json` 한 길로만
 * 온다. 여기서도 뽑으면 같은 값이 두 곳에 생기고, 언젠가 한쪽이 낡는다. 그래서 이 파일이
 * 담는 것은 **크기 · 여백 · 곡률 · 글자 크기 · 줄높이 · 굵기 · 시간 · 배율**이다.
 *
 * 무엇을 뽑는지는 아래 `WANTED`가 정한다 — 우리 부품이 실제로 대응하는 SEED 부품만이다.
 * 104개를 통째로 담으면 아무도 안 읽는 파일이 된다. 대조표는
 * `docs/sync/seed-component-parity.md`에 있고, 거기 나오는 이름이 곧 이 목록이다.
 *
 * **이 파일이 「SEED가 뭐라고 하는지」만 적는다는 것에 주의한다.** 우리가 그 값을 쓸지는
 * 별개다 — CLAUDE.md 최상위 1번은 「피그마 기준」이고, 피그마에 실측값이 있으면 그쪽이
 * 이긴다(2026-09-15 MASTER 확정). 여기 적힌 값은 **피그마가 말하지 않은 자리를 채울 때**
 * 쓰는 것이고, 어느 자리가 그런지는 대조표가 적는다.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(REPO, 'spec/seed-components.json');

const require_ = createRequire(import.meta.url);
const SEED_PKG = dirname(require_.resolve('@seed-design/rootage-artifacts/package.json'));
const SEED_VERSION = JSON.parse(readFileSync(join(SEED_PKG, 'package.json'), 'utf8')).version;
const GEN = join(SEED_PKG, '__generated__');

/**
 * 우리 부품이 대응하는 SEED 부품. `docs/sync/seed-component-parity.md`의 대조표와 짝이다.
 *
 * 값은 「우리 부품 이름」이고, 대조표에서 왜 이 대응인지 읽을 수 있게 적어 둔다.
 * 대응이 없는 우리 부품(`progress-bar` · `rating-stars` · `wedding-mark` …)은 여기 없다.
 */
const WANTED = {
  accordion: 'accordion',
  'accordion-item': 'accordion',
  'action-button': 'action-button',
  badge: 'badge · verification-badge · data-tier-badge · pick-status-badge',
  chip: 'filter-chip',
  'control-chip': 'filter-chip(선택형)',
  /** 우리 `fab` 56은 SEED `fab`(44)이 아니라 이쪽과 일치한다 — 이름만 보고 맞추면 12px 줄어든다. */
  'floating-action-button': 'fab',
  'list-header': 'section-header',
  'progress-circle': 'circle-loader',
  'segmented-control': 'segmented-tabs',
  'segmented-control-item': 'segmented-tabs',
  skeleton: 'skeleton · list-skeleton',
  snackbar: 'toast',
  'text-input': 'text-field · search-bar',
  'top-navigation-icon-button': 'icon-button',
  typography: 'themed-text',
};

/**
 * SEED 글자 크기 · 줄높이는 `rem`으로 적힌다. 우리는 RN이라 px 하나뿐이고, SEED 웹의
 * 루트 글자 크기가 16px이다. **환산하지 않고 그대로 두면 `0.875`가 화면에 들어간다.**
 */
const REM = 16;

/** `$dimension.x10` 같은 참조를 풀 표. 컬렉션을 한 덩어리로 합쳐 둔다. */
const tokens = new Map();

for (const file of [
  'dimension',
  'radius',
  'font-size',
  'line-height',
  'font-weight',
  'duration',
  'timing-function',
  'scale',
  'shadow',
  'gradient',
]) {
  const parsed = JSON.parse(readFileSync(join(GEN, `${file}.json`), 'utf8'));

  for (const [name, def] of Object.entries(parsed.data.tokens ?? {})) tokens.set(name, def.values);
}

/**
 * 값 하나를 끝까지 푼다.
 *
 * SEED는 참조를 겹쳐 쓴다(`$dimension.spacing-x.global-gutter` → `$dimension.x4` → 16px).
 * 따라가지 않으면 우리 쪽에 `$dimension.x4` 문자열이 그대로 들어간다.
 */
function resolveValue(value, seen = new Set()) {
  if (value === null || value === undefined) return null;

  // { value: 0.875, unit: 'rem' } 꼴. rem만 px로 환산하고 나머지 단위는 그대로 붙인다.
  if (typeof value === 'object' && !Array.isArray(value) && 'value' in value && 'unit' in value) {
    if (value.unit === 'rem') return `${value.value * REM}px`;

    return `${value.value}${value.unit}`;
  }

  if (Array.isArray(value)) {
    // cubic-bezier는 숫자 넷짜리 배열로 온다.
    if (value.every((item) => typeof item === 'number')) return `cubic-bezier(${value.join(',')})`;

    /*
     * 그림자 · 그라디언트는 겹겹이 쌓인 객체 배열이다. CSS가 적는 순서 그대로 한 줄로 편다 —
     * 여기서 우리가 쓰는 것은 **기하값**(치우침 · 번짐 · 자리)이고, 섞여 있는 색은 면 · 글자
     * 팔레트가 아니라 그림자 자체의 색이라 `spec/seed-tokens.json`과 경쟁하지 않는다.
     */
    return value
      .map((layer) => {
        if ('offsetX' in layer) {
          const part = (key) => resolveValue(layer[key]);

          return `${part('offsetX')} ${part('offsetY')} ${part('blur')} ${part('spread')} ${layer.color}`;
        }

        if ('position' in layer) return `${layer.color} ${Math.round(layer.position * 100)}%`;

        return JSON.stringify(layer);
      })
      .join(', ');
  }

  if (typeof value !== 'string') return value;
  if (!value.startsWith('$')) return value;

  // 같은 이름을 두 번 만나면 참조가 돌고 있다는 뜻이다. 무한히 돌지 않고 이름을 남긴다.
  if (seen.has(value)) return value;

  const values = tokens.get(value);

  if (!values) return value;

  seen.add(value);

  /*
   * 한 토큰이 여러 값을 들 수 있다. 어느 것을 고를지 이름별로 못 박는다 — 순서에 맡기면
   * SEED가 키를 하나 더 넣는 날 조용히 다른 값이 들어온다.
   *
   *   default      대부분의 토큰
   *   preferred    `$scale.s97` 같은 모션 값. `reduced`(=1)를 고르면 애니메이션이 사라진다
   *   theme-light  그림자 · 그라디언트. 밝은 테마가 우리 기본이다
   */
  const picked =
    values.default ?? values.preferred ?? values['theme-light'] ?? Object.values(values)[0];

  if (!picked) return value;

  return resolveValue(picked.value, seen);
}

/** 색은 여기서 뽑지 않는다 — `spec/seed-tokens.json` 한 길로만 온다. */
const isColor = (type, prop) => type === 'color' || /(^|[a-z])Color$/.test(prop);

/**
 * 컴포넌트 하나를 「variant → 상태 → 슬롯.속성 = 값」의 평평한 표로 만든다.
 *
 * rootage는 `definitions`를 **variant 묶음의 배열**로 준다. 묶음마다 그 안에 상태별
 * 정의가 또 배열로 들어 있어서, 두 겹을 펴야 사람이 읽을 수 있는 표가 된다.
 */
function flatten(id) {
  const parsed = JSON.parse(readFileSync(join(GEN, 'components', `${id}.json`), 'utf8'));
  const rows = {};

  for (const group of parsed.data.definitions ?? []) {
    const variant =
      Object.entries(group.variants ?? {})
        .map(([key, value]) => `${key}=${value}`)
        .join(',') || '$base';

    for (const def of group.definitions ?? []) {
      const state = (def.states ?? ['enabled']).join('|');

      for (const [slot, props] of Object.entries(def.slots ?? {})) {
        for (const [prop, spec] of Object.entries(props)) {
          if (isColor(spec.type, prop)) continue;

          const resolved = resolveValue(spec.value);

          if (resolved === null) continue;

          rows[variant] ??= {};
          rows[variant][state] ??= {};
          rows[variant][state][`${slot}.${prop}`] = resolved;
        }
      }
    }
  }

  return { $ours: WANTED[id], variants: parsed.data.schema?.variants ?? {}, values: rows };
}

function build() {
  const components = {};

  for (const id of Object.keys(WANTED).sort()) components[id] = flatten(id);

  return {
    $note:
      '생성된 파일이다. 손으로 고치지 마라 — `node scripts/sync-seed-components.mjs`가 ' +
      '`@seed-design/rootage-artifacts`에서 뽑아 쓴다. 어긋나면 `--check`가 빨개진다.',
    $why:
      'SEED가 무엇이라고 하는지만 적는다. 우리가 그 값을 쓸지는 별개다 — 피그마에 실측값이 ' +
      '있으면 그쪽이 이기고(CLAUDE.md 최상위 1번 · 2026-09-15 MASTER 확정), 여기 값은 ' +
      '피그마가 말하지 않은 자리를 채울 때 쓴다. 어느 자리가 그런지는 ' +
      'docs/sync/seed-component-parity.md가 적는다.',
    $units: `글자 크기 · 줄높이의 rem은 ${REM}px로 환산했다. 색은 여기 없다 — spec/seed-tokens.json이 담는다. 그림자 · 그라디언트만 예외로 기하값과 함께 그 자체의 색을 적는다(면 · 글자 팔레트가 아니다). 테마가 갈리는 값은 밝은 쪽이다.`,
    $source: `@seed-design/rootage-artifacts@${SEED_VERSION}`,
    components,
  };
}

const next = build();
const text = `${JSON.stringify(next, null, 2)}\n`;

if (process.argv.includes('--check')) {
  let current = '';

  try {
    current = readFileSync(OUT, 'utf8');
  } catch {
    console.error(`${OUT}이 없다. \`node scripts/sync-seed-components.mjs\`를 돌려서 만들어라.`);
    process.exit(1);
  }

  if (current !== text) {
    console.error(
      'spec/seed-components.json이 SEED와 어긋난다. `node scripts/sync-seed-components.mjs`를 돌려서 맞춰라.',
    );
    process.exit(1);
  }

  console.log(`SEED와 같다 (@seed-design/rootage-artifacts@${SEED_VERSION}).`);
} else {
  writeFileSync(OUT, text);
  console.log(
    `${OUT} — 부품 ${Object.keys(next.components).length}개 ` +
      `(@seed-design/rootage-artifacts@${SEED_VERSION})`,
  );
}
