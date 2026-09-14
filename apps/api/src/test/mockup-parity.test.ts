import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..', '..', '..');
const HTML = join(ROOT, 'docs', 'design-handoff', 'current', 'html');

/**
 * 목업 파일의 CSS 문자열과 토큰을 직접 대조한다.
 *
 * 2026-09-10 전수 재검수에서 드러난 것: **SPEC 요약 표를 통과했다고 목업과 같은 것이
 * 아니다.** 데이트피커는 SPEC 13.7의 항목 목록과 맞아 「현행 사양대로」로 판정됐는데,
 * 목업 파일을 열어 보니 넷이 달랐다(선택일 모양 · 펼침 칸 둥글기 · 셀렉트 패딩 · 칸 글자).
 *
 * 그래서 이 시험은 SPEC 문장이 아니라 `.dc.html` 안의 선언을 읽는다. 목업이 바뀌면
 * 여기서 먼저 깨지고, 토큰을 목업과 다르게 고쳐도 여기서 깨진다.
 *
 * `docs/design-handoff/current/`는 전달 ZIP에서 그대로 추출한 원본이라 읽기만 한다.
 */

type Tokens = Record<string, any>;

function tokens(): Tokens {
  return JSON.parse(readFileSync(join(ROOT, 'spec', 'tokens.json'), 'utf8'));
}

function mockup(file: string): string {
  const path = join(HTML, file);
  if (!existsSync(path)) throw new Error(`목업이 없다: ${file}`);
  return readFileSync(path, 'utf8');
}

/**
 * 목업에서 이름 붙은 스타일 상수 한 줄을 찾아 그 안의 선언 하나를 읽는다.
 *
 * 목업의 스타일은 `optCell: 'height:44px;border-radius:8px;…'` 꼴의 문자열 상수다.
 * 줄 전체를 잡은 뒤 `prop:value`를 뽑으면 시안이 실제로 그리는 값이 나온다.
 */
function decl(file: string, constName: string, prop: string): string {
  const src = mockup(file);
  const at = src.search(new RegExp(`(^|[\\s{,])${constName}\\s*[:=]`, 'm'));
  if (at < 0) throw new Error(`${file}에 ${constName}이 없다`);
  /* 화살표 함수로 쓴 상수는 선언이 여러 줄에 걸친다 — 이름 뒤 한 덩어리를 통째로 본다. */
  const block = src.slice(at, at + 700);
  const m = block.match(new RegExp(`[;'"\\s(]${prop}\\s*:\\s*([^;'"]+)`));
  if (!m?.[1]) throw new Error(`${file}의 ${constName}에서 ${prop}를 찾지 못했다`);
  return m[1].trim();
}

/** 이름 붙은 상수 뒤 한 덩어리를 그대로 준다 — 색이 삼항으로 붙는 자리를 볼 때 쓴다. */
function block(file: string, constName: string): string {
  const src = mockup(file);
  const at = src.search(new RegExp(`(^|[\\s{,])${constName}\\s*[:=]`, 'm'));
  if (at < 0) throw new Error(`${file}에 ${constName}이 없다`);
  return src.slice(at, at + 700);
}

function px(value: string): number {
  const m = value.match(/^(-?\d+(?:\.\d+)?)px$/);
  if (!m) throw new Error(`px 값이 아니다: ${value}`);
  return Number(m[1]);
}

describe('목업 CSS와 토큰이 같은 값을 든다', () => {
  /*
   * 데이트피커(WP-APP-023). SPEC 13.7 본문은 선택일을 「coral 원」이라 적지만
   * 목업은 8px 사각이고, 목업이 이긴다.
   */
  it('연·월 칸과 날짜 칸의 둥글기는 radius.picker다', () => {
    const optCell = px(decl('20-onboarding-v2.dc.html', 'optCell', 'border-radius'));
    const dayCell = px(decl('20-onboarding-v2.dc.html', 'dayCell', 'border-radius'));

    expect(optCell).toBe(dayCell);
    expect(tokens().radius.picker).toBe(optCell);
  });

  it('연·월 셀렉트는 높이 size.field · 둥글기 radius.card다', () => {
    const t = tokens();
    expect(px(decl('20-onboarding-v2.dc.html', 'selBox', 'height'))).toBe(t.size.field);
    expect(px(decl('20-onboarding-v2.dc.html', 'selBox', 'border-radius'))).toBe(t.radius.card);
  });

  it('온보딩 인라인 토스트는 component.toast와 같다', () => {
    const t = tokens().component.toast;
    expect(px(decl('20-onboarding-v2.dc.html', 'toastBox', 'height'))).toBe(t.height);
    /* padding:0 18px — 좌우만 읽는다. */
    const [, toastPaddingX] = decl('20-onboarding-v2.dc.html', 'toastBox', 'padding').split(/\s+/);
    expect(px(toastPaddingX ?? '')).toBe(t.paddingX);
    expect(decl('20-onboarding-v2.dc.html', 'toastBox', 'border-radius')).toBe(`${t.radius}px`);
  });

  /*
   * v3.27 관리자 — 상단 상태 배너의 원형 아이콘 칠은 배너 바탕과 달라야 한다.
   * 같은 색으로 칠하면 원이 사라진다.
   */
  it('관리자 상태 배너 색이 시안 값이다', () => {
    const admin = tokens().color.admin;
    /* alertIconStyle의 색은 문자열 뒤 삼항으로 붙는다 — 덩어리 안에 값이 있는지로 본다. */
    const iconBlock = block('22-admin-ops.dc.html', 'alertIconStyle').toLowerCase();
    expect(iconBlock).toContain(admin.bannerOkIconBg.value.toLowerCase());
    expect(iconBlock).toContain(admin.bannerBadIconBg.value.toLowerCase());
    expect(admin.bannerOkIconBg.value.toLowerCase()).not.toBe(
      tokens().color.status.successFg.bg.toLowerCase()
    );
    expect(admin.bannerBadIconBg.value.toLowerCase()).not.toBe(
      tokens().color.status.dangerFg.bg.toLowerCase()
    );
  });

  it('관리자 사이드바 그룹 라벨 색이 시안 값이다', () => {
    expect(decl('22-admin-ops.dc.html', 'navGroup', 'color').toLowerCase()).toBe(
      tokens().color.admin.sidebarGroup.value.toLowerCase()
    );
  });

  /*
   * v3.27 관리자 — 줄 높이가 앱 스케일과 다르다.
   *
   * 2026-09-10 재검수에서 드러난 것: 열한 화면이 앱 짝(`tab` 12/16 · `micro` 13/18 ·
   * `t7` 14/19 · `t5` 18/24)을 그대로 쓰고 있었는데, 시안은 같은 크기에 다른 줄 높이를
   * 준다. 표 한 줄이 1px씩 어긋나면 여덟 줄에서 8px이 밀리고, 1920 기준으로 맞춰 둔
   * 카드 높이가 따라 어긋난다. 가까운 값으로 대신하지 않는다 — 토큰에 더한다.
   */
  it('관리자 줄 높이가 시안 값이다', () => {
    const scale = tokens().typography.scale as { role: string; size: number; lineHeight: number }[];
    const role = (name: string) => {
      const found = scale.find((r) => r.role === name);
      if (!found) throw new Error(`typography.scale에 ${name}이 없다`);
      return found;
    };

    const cases: [string, string, string][] = [
      /* [토큰 이름, 목업 상수, 목업이 그 줄 높이를 쓰는 자리] */
      ['adminMeta', 'cardSub', '카드 부제'],
      ['adminMeta', 'rowMeta', '행 메타'],
      ['adminMeta', 'barLabel', '막대 라벨'],
      ['adminNote', 'noteLine', '카드 각주'],
      ['adminCell', 'alertBody', '배너 풀이'],
      ['adminConfirmTitle', 'confirmTitle', '확인 카드 제목'],
    ];

    for (const [token, constName, where] of cases) {
      const t = role(token);
      expect({
        where,
        size: px(decl('22-admin-ops.dc.html', constName, 'font-size')),
        lineHeight: px(decl('22-admin-ops.dc.html', constName, 'line-height')),
      }).toEqual({ where, size: t.size, lineHeight: t.lineHeight });
    }

    /* 빈 상태 제목은 배너 제목과 같은 15/21이다. */
    expect(px(decl('22-admin-ops.dc.html', 'emptyTitle', 'font-size'))).toBe(role('adminBanner').size);
    expect(px(decl('22-admin-ops.dc.html', 'emptyTitle', 'line-height'))).toBe(
      role('adminBanner').lineHeight
    );
  });

  /*
   * 표 머리 아래 선과 본문 행 사이 선은 **다른 색**이다. 같은 색으로 두면 열 이름이
   * 본문 첫 줄과 붙어 읽혀서 데이터처럼 보인다.
   */
  it('표 머리 선이 본문 행 선보다 진하다', () => {
    const t = tokens();
    const rowLine = t.color.admin.rowLine.value.toLowerCase();
    const headLine = t.color.line.border.value.toLowerCase();

    expect(decl('22-admin-ops.dc.html', 'tbodyRow', 'box-shadow').toLowerCase()).toContain(rowLine);
    expect(decl('22-admin-ops.dc.html', 'theadRow', 'box-shadow').toLowerCase()).toContain(headLine);
    expect(decl('22-admin-ops.dc.html', 'hr', 'background').toLowerCase()).toBe(rowLine);
    expect(rowLine).not.toBe(headLine);
  });

  /* 재검수에서 어긋나 있던 간격들. 8배수 사다리에 없는 값이라 이름으로 든다. */
  it('관리자 간격이 시안 값이다', () => {
    const sp = tokens().spacing;
    const M = '22-admin-ops.dc.html';

    expect(px(decl(M, 'topbar', 'gap'))).toBe(sp.adminTableGap.value);
    expect(px(decl(M, 'cardHead', 'min-height'))).toBe(sp.adminCardHeadHeight.value);
    expect(px(decl(M, 'kpiCard', 'gap'))).toBe(sp.adminKpiGap.value);
    expect(px(decl(M, 'barsWrap', 'height'))).toBe(sp.adminBarsHeight.value);
    expect(px(decl(M, 'brandRow', 'gap'))).toBe(sp.adminIconTextGap.value);
    expect(px(decl(M, 'confirmItem', 'gap'))).toBe(sp.adminIconTextGap.value);
    expect(px(decl(M, 'confirmActions', 'gap'))).toBe(sp.adminConfirmActionsGap.value);
    expect(px(decl(M, 'confirmCard', 'gap'))).toBe(sp.adminBannerGap.value);
    /* side «padding:20px 12px» — 상하 · 좌우 순. */
    const [sideY, sideX] = decl(M, 'side', 'padding').split(/\s+/);
    expect(px(sideY ?? '')).toBe(sp.adminSidebarPaddingY.value);
    expect(px(sideX ?? '')).toBe(sp.adminSidebarPaddingX.value);
    /* navGroup «padding:16px 12px 6px» — 아래가 6이다. */
    const navGroupBottom = decl(M, 'navGroup', 'padding').split(/\s+/)[2];
    expect(px(navGroupBottom ?? '')).toBe(sp.adminNavGroupPaddingBottom.value);
    /* 확인 카드 항목 상자는 radius.picker(8)다 — control(6)이 아니다. */
    expect(px(decl(M, 'confirmList', 'border-radius'))).toBe(tokens().radius.picker);
  });

  /* 화면 설정 스와치 — 시안은 안팎 모두 3이다. focus(2)로 대신하면 흰 테가 얇아진다. */
  it('스킨 스와치 링 두께가 border.swatchRing이다', () => {
    const shadow = decl('13-my-sub.dc.html', 'swatch', 'box-shadow');
    const m = shadow.match(/0 0 0 (\d+)px/);
    expect(m).not.toBeNull();
    expect(tokens().border.swatchRing).toBe(Number(m![1]));
  });
});

describe('목업 파일 자체가 자리에 있다', () => {
  /*
   * 20-admin과 21-admin은 바이트 단위로 같은 1440 구판이고, v3.27 신판은
   * 22-admin-ops 하나다. 구판을 기준으로 삼아 되돌리는 일이 없도록 적어 둔다.
   */
  it('v3.27 관리자 신판은 22-admin-ops다', () => {
    expect(mockup('20-admin.dc.html')).toBe(mockup('21-admin.dc.html'));
    expect(mockup('20-admin.dc.html')).toContain('width:1440px');
    expect(mockup('22-admin-ops.dc.html')).not.toContain('width:1440px');
  });
});
