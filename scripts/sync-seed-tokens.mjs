#!/usr/bin/env node
/**
 * SEED 디자인 시스템의 값을 **뽑아서** `spec/seed-tokens.json`에 적는다.
 *
 * **왜 있는가.** 우리 색 토큰은 SEED를 손으로 베낀 것이었고, 베낀 뒤에 SEED가
 * 움직이는 동안 우리 쪽은 그대로였다. 2026-09-15에 재어 보니 본문 글자색이
 * `#212124`(우리)와 `#1A1C20`(SEED 현행)으로 갈라져 있었다 — 모든 화면에 걸리는
 * 차이인데 아무도 몰랐다. **손으로 베끼면 반드시 다시 갈라진다.** 그래서 뽑는다.
 *
 * `@seed-design/css`는 웹용 CSS라 RN에 그대로 못 넣는다(SEED에 RN 판이 없다).
 * 그래서 **빌드 때만 쓰는 의존성**으로 두고 값만 꺼내 온다. 앱이 읽는 것은
 * 지금까지처럼 `spec/tokens.json` 하나다.
 *
 *   node scripts/sync-seed-tokens.mjs           # spec/seed-tokens.json을 새로 쓴다
 *   node scripts/sync-seed-tokens.mjs --check   # 어긋나면 빨개진다(CI용)
 *
 * 우리 토큰이 SEED와 맞는지는 `spec/seed-parity.test.ts`가 지킨다.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(REPO, 'spec/seed-tokens.json');

const require_ = createRequire(import.meta.url);
const SEED_PKG = dirname(require_.resolve('@seed-design/css/package.json'));
const SEED_VERSION = JSON.parse(readFileSync(join(SEED_PKG, 'package.json'), 'utf8')).version;

/**
 * 어두운 값이 시작하는 자리를 찾는 표.
 *
 * `base.css`는 팔레트를 **정확히 두 번** 적는다 — 밝은 것 한 벌, 어두운 것 한 벌.
 * 나누지 않고 읽으면 **어두운 값이 밝은 값을 덮어써서** 흰 배경에 흰 글자가 된다.
 *
 * 선택자 문자열로 자르지 않는다. `[data-seed-color-mode="dark-only"]`는 팔레트보다
 * 한참 앞의 `color-scheme` 블록에도 나와서, 그것으로 자르면 밝은 값이 0개가 된다
 * (실제로 그렇게 짰다가 걸렸다). **값이 두 번째로 적히는 자리**를 보는 것이 맞다.
 */
const PALETTE_ANCHOR = '--seed-color-palette-gray-00';

/** `--이름: 값;` 을 전부 줍는다. 마지막에 적힌 것이 이긴다(CSS와 같다). */
function collectVars(css) {
  const found = new Map();

  for (const match of css.matchAll(/(--seed-[a-z0-9-]+)\s*:\s*([^;}]+)[;}]/g)) {
    found.set(match[1], match[2].trim());
  }

  return found;
}

/**
 * `var(--다른이름)`을 끝까지 따라간다.
 *
 * SEED는 팔레트 → 시맨틱으로 두 겹을 쓴다(`bg-layer-default` → `palette-gray-00`).
 * 따라가지 않으면 우리 쪽에 `var(...)` 문자열이 그대로 들어가 앱에서 색이 사라진다.
 */
function resolve_(name, vars, seen = new Set()) {
  const raw = vars.get(name);

  if (raw === undefined) return null;
  if (seen.has(name)) throw new Error(`토큰이 서로를 가리킨다: ${name}`);

  seen.add(name);

  const ref = /^var\((--seed-[a-z0-9-]+)\)$/.exec(raw);

  return ref ? resolve_(ref[1], vars, seen) : raw;
}

/**
 * `#fff` → `#FFFFFF`. 길이와 대소문자가 갈리면 **같은 색이 달라 보인다** —
 * 눈으로 대조할 때도, 시험이 문자열로 견줄 때도 그렇다.
 *
 * 투명도가 붙은 여덟 자리(`#00000010`)도 그대로 둔다. SEED의 선 색이 그렇다.
 */
function normalizeHex(value) {
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])([0-9a-f])?$/i.exec(value);

  if (short) {
    const doubled = short.slice(1).filter(Boolean).map((c) => c + c).join('');

    return `#${doubled}`.toUpperCase();
  }

  return /^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(value) ? value.toUpperCase() : value;
}

function readSeed() {
  const css = readFileSync(join(SEED_PKG, 'base.css'), 'utf8');
  /**
   * **적는 자리만** 센다. `var(--seed-color-palette-gray-00)`처럼 **가리키는 자리**는
   * 세면 안 된다 — 처음에 그것까지 세는 바람에 자르는 곳이 한참 앞으로 가서 밝은 값이
   * 일곱 개만 잡혔다. 뒤에 `:`가 오는 것이 적는 자리다.
   */
  const spots = [...css.matchAll(new RegExp(`${PALETTE_ANCHOR}\\s*:`, 'g'))].map((m) => m.index);

  if (spots.length !== 2) {
    throw new Error(`base.css에서 팔레트를 두 번 찾지 못했다(${spots.length}번): ${PALETTE_ANCHOR}`);
  }

  /** 두 번째 팔레트가 든 규칙의 시작 — 그 앞의 마지막 `}` 다음이다. */
  const cut = css.lastIndexOf('}', spots[1]) + 1;

  const light = collectVars(css.slice(0, cut));
  /** 어두운 쪽은 밝은 값을 바탕에 깔고 덮어쓴다 — 거기서 다시 적지 않는 이름이 많다. */
  const dark = new Map([...light, ...collectVars(css.slice(cut))]);

  const pick = (vars) => {
    const out = {};

    for (const name of [...vars.keys()].sort()) {
      if (!name.startsWith('--seed-color-') && !name.startsWith('--seed-radius-')) continue;

      const value = resolve_(name, vars);

      if (value === null) continue;

      out[name.replace('--seed-', '')] = normalizeHex(value);
    }

    return out;
  };

  return { light: pick(light), dark: pick(dark) };
}

function build() {
  const { light, dark } = readSeed();

  return {
    $note:
      '생성된 파일이다. 손으로 고치지 마라 — `node scripts/sync-seed-tokens.mjs`가 ' +
      '`@seed-design/css`의 base.css에서 뽑아 쓴다. 우리 토큰이 여기서 벗어나면 ' +
      '`spec/seed-parity.test.ts`가 빨개진다.',
    $source: `@seed-design/css@${SEED_VERSION} base.css`,
    light,
    dark,
  };
}

const next = build();
const text = `${JSON.stringify(next, null, 2)}\n`;

if (process.argv.includes('--check')) {
  const current = readFileSync(OUT, 'utf8');

  if (current !== text) {
    console.error(
      'spec/seed-tokens.json이 SEED와 어긋난다. `node scripts/sync-seed-tokens.mjs`를 돌려서 맞춰라.',
    );
    process.exit(1);
  }

  console.log(`SEED와 같다 (@seed-design/css@${SEED_VERSION}).`);
} else {
  writeFileSync(OUT, text);
  console.log(
    `${OUT} — 밝은 값 ${Object.keys(next.light).length}개 · 어두운 값 ${Object.keys(next.dark).length}개 ` +
      `(@seed-design/css@${SEED_VERSION})`,
  );
}
