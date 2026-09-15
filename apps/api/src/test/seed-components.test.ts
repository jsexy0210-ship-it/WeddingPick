import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..', '..', '..');

/**
 * 부품의 크기 · 여백 · 곡률이 SEED에서 벗어나지 않게 지킨다.
 *
 * **왜 있는가.** `seed-parity.test.ts`가 색에 대해 하는 일과 같다. 색은 손으로 베낀 뒤
 * SEED가 움직이는 동안 우리만 그대로여서 본문 먹색이 갈라져 있었다(2026-09-15). 크기도
 * 똑같이 갈라진다 — 다만 **더 조용히** 갈라진다. 4px은 따로 보면 아무도 모르고 시안과
 * 나란히 놓아야 드러난다.
 *
 * 두 가지를 센다.
 *
 * 1. `spec/seed-components.json`이 현행인가 — 뽑는 스크립트를 `--check`로 돌린다.
 * 2. **우리가 「이미 SEED와 같다」고 적어 둔 값이 정말 같은가** — 아래 표가 그것이다.
 *    대조표(`docs/sync/seed-component-parity.md`)가 「고칠 필요가 없다」고 적은 자리는
 *    글로만 남으면 다음 사람이 다시 재야 한다. 세는 시험으로 옮겨 둔다.
 *
 * **여기 없는 값도 많다.** 피그마에 실측값이 있는 자리는 피그마가 이기고(CLAUDE.md 최상위
 * 1번 · 2026-09-15 MASTER 확정) SEED와 달라도 맞다 — 곡률 16 · 좌우 여백 20 · `f*` 사다리 ·
 * `segmented-tabs`가 그렇다. 그런 자리를 여기 넣으면 시험이 피그마를 되돌리라고 요구하게 된다.
 */
const read = (path: string) => JSON.parse(readFileSync(join(ROOT, path), 'utf8'));

type Seed = {
  $source: string;
  components: Record<string, { values: Record<string, Record<string, Record<string, unknown>>> }>;
};

const seed = read('spec/seed-components.json') as Seed;
const tokens = read('spec/tokens.json') as {
  size: Record<string, number>;
  typography: { scale: { role: string; size: number; lineHeight: number | string }[] };
};

/** `[SEED 부품, variant, 상태, 슬롯.속성, 우리 값, 어디가 그 값을 드는가]` */
const SAME: [string, string, string, string, string | number, string][] = [
  // 떠 있는 단추. SEED `fab`은 44라 이름만 보고 맞추면 12px 줄어든다.
  ['floating-action-button', 'extended=false', 'enabled', 'root.size', '56px', 'fab.tsx SIZE'],
  // 입력 칸 — 높이와 글자. 곡률(우리 16 · SEED 12)은 피그마 몫이라 여기 없다.
  ['text-input', 'variant=outline,size=large', 'enabled', 'root.minHeight', '52px', 'size.field'],
  ['text-input', 'variant=outline,size=large', 'enabled', 'value.fontSize', '16px', 'FontSize.t6'],
  ['text-input', 'variant=outline,size=large', 'enabled', 'value.lineHeight', '22px', 'LineHeight.t6'],
  // 포커스 · 오류 테두리. 피그마 규격서에 포커스 상태가 없어 SEED를 따랐다.
  ['text-input', 'variant=outline', 'focused', 'root.strokeWidth', '2px', 'Border.focus'],
  // 칩 기본 높이.
  ['control-chip', 'size=medium', 'enabled', 'root.minHeight', '36px', 'Layout.chip'],
  // 버튼 높이 두 자리. 40 · 52만 SEED와 겹친다(48은 SEED에 없는 칸이다).
  ['action-button', 'size=medium', 'enabled', 'root.minHeight', '40px', 'Layout.controlMedium'],
  ['action-button', 'size=large', 'enabled', 'root.minHeight', '52px', 'Layout.controlXLarge'],
  // 세 칸 탭의 안쪽 여백. 칸 크기 · 곡률 · 글자는 피그마가 이겨서 여기 없다.
  ['segmented-control', '$base', 'enabled', 'root.padding', '4px', 'Spacing.one'],
];

/**
 * 우리 타이포 사다리 ↔ SEED `typography`.
 *
 * **이름이 역순이다** — 우리 t1이 가장 크고 SEED t1이 가장 작다. 값은 같은데 이름이 반대라
 * 옮길 때 뒤집어 적기 쉽다(t4를 t4에 맞추면 20px이 14px이 된다). 그래서 역할 이름으로 맞춘다.
 */
const TYPE_LADDER: [string, string][] = [
  ['display', 't12'],
  ['title', 't10'],
  ['heading', 't9'],
  ['section', 't7'],
  ['body', 't6'],
  ['sub', 't5'],
  ['caption', 't4'],
  ['micro', 't3'],
];

describe('부품 크기는 SEED에서 온다', () => {
  it('spec/seed-components.json이 현행이다', () => {
    /*
     * 생성물이 조용히 낡는 것을 막는다. 스크립트가 어긋남을 찾으면 0이 아닌 코드로 끝나고
     * execFileSync가 던진다 — 그때 메시지에 무엇을 돌리라는지가 적혀 있다.
     */
    expect(() =>
      execFileSync('node', ['scripts/sync-seed-components.mjs', '--check'], {
        cwd: ROOT,
        encoding: 'utf8',
      }),
    ).not.toThrow();
  });

  it('「이미 SEED와 같다」고 적은 값이 정말 같다', () => {
    const drifted = SAME.filter(([component, variant, state, prop, ours]) => {
      const theirs = seed.components[component]?.values?.[variant]?.[state]?.[prop];

      return theirs !== ours;
    }).map(([component, variant, state, prop, ours, where]) => {
      const theirs = seed.components[component]?.values?.[variant]?.[state]?.[prop];

      return `${component}[${variant}][${state}].${prop}: 우리 ${ours}(${where}) ≠ SEED ${String(theirs)}`;
    });

    expect(drifted).toEqual([]);
  });

  it('타이포 사다리가 SEED와 같다', () => {
    const type = seed.components.typography?.values ?? {};
    const drifted: string[] = [];

    for (const [role, seedStep] of TYPE_LADDER) {
      const ours = tokens.typography.scale.find((row) => row.role === role);

      if (!ours) {
        drifted.push(`${role}: spec/tokens.json에 없다`);
        continue;
      }

      const theirs = type[`textStyle=${seedStep}Bold`]?.enabled;

      if (!theirs) {
        drifted.push(`${role}: SEED ${seedStep}을 못 찾았다`);
        continue;
      }

      if (theirs['root.fontSize'] !== `${ours.size}px`) {
        drifted.push(`${role} 크기: 우리 ${ours.size} ≠ SEED ${String(theirs['root.fontSize'])}`);
      }

      /*
       * spec은 줄높이 변형을 «22|24|26»처럼 문자열로 적는다 — 그중 하나라도 SEED와 맞으면
       * 된다. 어느 자리에 어느 변형을 쓰는지는 화면이 정하고, 이 시험이 볼 일은 아니다.
       */
      const allowed = String(ours.lineHeight)
        .split('|')
        .map((value) => `${value.trim()}px`);

      if (!allowed.includes(String(theirs['root.lineHeight']))) {
        drifted.push(
          `${role} 줄높이: 우리 ${String(ours.lineHeight)} ≠ SEED ${String(theirs['root.lineHeight'])}`,
        );
      }
    }

    expect(drifted).toEqual([]);
  });
});
