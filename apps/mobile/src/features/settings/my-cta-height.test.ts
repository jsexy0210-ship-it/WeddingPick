import { Layout } from '@weddingpick/ui';

/**
 * MY 화면군 하단 고정 CTA 높이 — **정본 `docs/design/React_Native/my.js`가 56이라고 적은 자리만 56**이다
 * (2026-09-26 대표 감사). 전역 토큰(`controlXLarge` 52 · `ctaSheet` 56)은 바꾸지 않고, 화면이
 * 어느 크기를 고르는지만 정본에 묶는다. 바텀시트 안 CTA는 이 시험의 대상이 아니다(시트 규격 그대로).
 *
 *   정본 my.js                        화면(WP)                          구현
 *   ctaFull    height:56px           문의하기 008 · 스타일 014 ·       my-kit `Dock` → ActionButton size="sheet"
 *                                    박람회 LNG-003 · 웨딩노트로 가기
 *   ctaDanger  height:56px           회원탈퇴 012 · 연결 해제          my-kit `Dock`(danger) · partner «연결 끊기»
 *   ctaKakao   height:56px           배우자 초대 CPL-001              partner.tsx size="sheet"
 *   btnGhostHalf · ctaHalf 56        초대 수락 CPL-002 «나중에 · 수락하기»  join.tsx size="sheet"
 *   btnLine    height:48px           «코드 복사 · 코드 다시 받기»        partner.tsx size="large"(48)
 *   rowPlain   min-height:52px       프로필 002 «로그아웃 · 회원 탈퇴»  행이지 CTA가 아니다 — 52 그대로
 *
 * MY 비로그인 «로그인» CTA(my/index.tsx `size="xlarge"` 52)는 정본에 그 상태가 없어 근거가 없다 —
 * 바꾸지 않는다(DESIGN_SOURCE_NOT_VERIFIED).
 */

/** 테스트 러너(CommonJS)의 전역. 앱 번들에는 들어가지 않는다. */
declare const require: (id: string) => any;
declare const __dirname: string;

const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const src = join(__dirname, '..', '..');
const repo = join(src, '..', '..', '..');
const read = (path: string): string => readFileSync(join(src, path), 'utf8');
const canon = readFileSync(join(repo, 'docs/design/React_Native/my.js'), 'utf8') as string;

/** 정본 my.js 모델의 스타일 한 줄 — `key: '...height:56px...'`. */
function canonStyle(key: string): string {
  const match = canon.match(new RegExp(`\\n\\s+${key}: '([^']*)'`));
  if (!match) throw new Error(`정본 my.js에 ${key}가 없다`);
  return match[1]!;
}

function canonHeight(key: string): number {
  const match = canonStyle(key).match(/(?:^|;)(?:min-)?height:(\d+)px/);
  if (!match) throw new Error(`정본 my.js ${key}에 높이가 없다`);
  return Number(match[1]);
}

describe('MY 하단 CTA 높이는 정본 my.js 값을 따른다', () => {
  it('정본: 하단 고정 CTA 다섯은 56, 줄 단추는 48, 목록 행은 52', () => {
    expect(['ctaFull', 'ctaDanger', 'ctaKakao', 'btnGhostHalf', 'ctaHalf'].map(canonHeight)).toEqual([56, 56, 56, 56, 56]);
    expect(canonHeight('btnLine')).toBe(48);
    expect(canonHeight('rowPlain')).toBe(52);
  });

  it('전역 토큰은 그대로 — sheet 56 · xlarge 52 · large 48', () => {
    expect(Layout.ctaSheet).toBe(56);
    expect(Layout.controlXLarge).toBe(52);
    expect(Layout.controlLarge).toBe(48);
  });

  it('MY 하단 도크(my-kit Dock)는 56(size="sheet") — 문의하기 · 스타일 · 회원탈퇴 · 박람회 상세', () => {
    const kit = read('features/settings/my-kit.tsx');
    const dock = kit.slice(kit.indexOf('export function Dock('), kit.indexOf('// ─── 블록'));
    expect(dock.match(/size="sheet"/g)).toHaveLength(2);
    expect(dock).not.toMatch(/size="(xlarge|large|medium)"/);
    for (const screen of ['app/(tabs)/my/contact.tsx', 'app/(tabs)/my/taste.tsx', 'app/(tabs)/my/withdrawal.tsx', 'app/(tabs)/search/expo/[expoId]/index.tsx']) {
      expect(read(screen)).toMatch(/<Dock\b/);
    }
  });

  it('연결관리 · 초대 수락 도크 CTA도 56, 코드 복사 줄은 48', () => {
    const partner = read('app/(tabs)/wedding/partner.tsx');
    const join = read('app/(tabs)/wedding/join.tsx');
    const dockButtons = (source: string) =>
      [...source.matchAll(/<Dock\b[^>]*>([\s\S]*?)<\/Dock>/g)].flatMap((m) => [...m[1]!.matchAll(/size="(\w+)"/g)].map((s) => s[1]));
    expect(dockButtons(partner).length).toBeGreaterThan(0);
    expect(new Set(dockButtons(partner))).toEqual(new Set(['sheet']));
    expect(new Set(dockButtons(join))).toEqual(new Set(['sheet']));
    expect(partner).toMatch(/size="large"\s+label=\{S\.copy\}/);
  });
});
