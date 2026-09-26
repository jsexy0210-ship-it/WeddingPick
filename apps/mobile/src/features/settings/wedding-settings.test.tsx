import React from 'react';
import { AccessibilityInfo } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { completeSetup, getCurrentUser } from '@/api/client';
import WeddingSettingsScreen from '@/app/(tabs)/my/wedding-settings';

import {
  PREP_NONE_KEY,
  budgetOptions,
  prepCategoriesFromKey,
  prepComboKeyOf,
  prepOptions,
  prepValueLabel,
} from './wedding-setting-options';

/**
 * 내 웨딩설정(WP-MY-003) — 2026-09-26 대표 지시 「모든 항목 휠 바텀시트 · 날짜 외에는 1열 휠」.
 * 스타일만 같은 날 「개수제한 없다」로 다중 선택 시트다(1열 휠은 하나만 가리킨다).
 * 시트는 이름만 남겨 받은 props(보이는가 · 보기 · 지금 값)를 본다.
 */

jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn() } }));
jest.mock('@/api/client', () => ({
  ApiError: class ApiError extends Error {},
  completeSetup: jest.fn(),
  getCurrentUser: jest.fn(),
}));
jest.mock('@/features/navigation/depth-back', () => ({ useDepthBack: () => jest.fn() }));
jest.mock('@/features/loading/delayed-loader', () => ({ DelayedLoadingView: 'Loading' }));
jest.mock('@/features/settings/my-kit', () => ({ NoteBox: 'NoteBox', Section: 'Section', SubScreen: 'SubScreen', SubScreenStatus: 'SubScreenStatus' }));
jest.mock('@/features/common/wheel-picker-sheet', () => ({
  DateWheelSheet: 'DateWheelSheet',
  OptionWheelSheet: 'OptionWheelSheet',
}));
jest.mock('@/features/onboarding/region-picker-sheet', () => ({ RegionPickerSheet: 'RegionPickerSheet' }));
jest.mock('@/features/settings/style-pick-sheet', () => ({ StylePickSheet: 'StylePickSheet' }));

const me = {
  userId: 'user-1',
  weddingDate: '2027-05-16',
  region: '서울특별시 강남구',
  preparedCategories: ['hall'],
  budgetBracket: '20m_30m',
  budgetAmount: 30_000_000,
  styleTags: ['ROMANTIC', 'URBAN'],
};

let tree: ReactTestRenderer;

async function mount() {
  await act(async () => {
    tree = create(<WeddingSettingsScreen />);
  });
}

afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
});

beforeEach(() => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  jest.spyOn(AccessibilityInfo, 'addEventListener').mockReturnValue({ remove: () => undefined } as never);
  jest.mocked(getCurrentUser).mockResolvedValue(me as never);
  jest.mocked(completeSetup).mockImplementation(async (body) => ({ ...me, ...body }) as never);
});

/** 다섯 행 — 라벨 순서대로. */
function rows() {
  return tree.root.findAll(
    (node) => node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function' && typeof node.type !== 'string'
  );
}

function sheet(type: string, title?: string) {
  return tree.root.find((node) => node.type === type && (title === undefined || node.props.title === title));
}

function visibleSheets(): string[] {
  return tree.root
    .findAll((node) => typeof node.type === 'string' && /Sheet$/.test(node.type) && node.props.visible === true)
    .map((node) => `${node.type as string}:${(node.props.title as string | undefined) ?? ''}`);
}

describe('내 웨딩설정 — 행마다 휠 바텀시트', () => {
  it('다섯 행이 각자 시트를 연다 — 한 번에 하나만', async () => {
    await mount();

    const labels = rows().map((row) => row.props.accessibilityLabel as string);
    expect(labels.map((label) => label.split(' ')[0])).toEqual(['예식일', '지역', '준비', '예산', '스타일']);
    expect(visibleSheets()).toEqual([]);

    const expected = [
      'DateWheelSheet:예식일 선택',
      'RegionPickerSheet:',
      'OptionWheelSheet:준비 현황 선택',
      'OptionWheelSheet:예산 선택',
      'StylePickSheet:스타일 선택',
    ];
    for (const [index, row] of rows().entries()) {
      await act(async () => row.props.onPress());
      expect(visibleSheets()).toEqual([expected[index]]);
    }
  });

  it('인라인 편집기가 없다 — 행 아래에 온보딩 부품을 펼치지 않는다', async () => {
    await mount();
    await act(async () => rows()[1]!.props.onPress());

    const json = JSON.stringify(tree.toJSON());
    expect(json).not.toContain('OptionRow');
    expect(json).not.toContain('여러 개 고를 수 있어요');
  });

  it('시트는 지금 값에서 연다', async () => {
    await mount();

    expect(sheet('DateWheelSheet').props.value).toBe('2027-05-16');
    expect(sheet('RegionPickerSheet').props.value).toEqual({ region: '서울', district: '강남구' });
    expect(sheet('OptionWheelSheet', '준비 현황 선택').props.value).toBe('hall');
    expect(sheet('OptionWheelSheet', '예산 선택').props.value).toBe('20m_30m');
    expect(sheet('StylePickSheet').props.value).toEqual(['ROMANTIC', 'URBAN']);
  });

  it('「확인」을 누른 항목 하나만 저장한다 — 예식일 · 지역은 지금 값을 돌려보낸다', async () => {
    await mount();

    await act(async () => sheet('OptionWheelSheet', '예산 선택').props.onConfirm('over_30m'));
    expect(completeSetup).toHaveBeenLastCalledWith({
      weddingDate: '2027-05-16',
      region: '서울특별시 강남구',
      budgetBracket: 'over_30m',
    });

    /* 개수 한도 없음(2026-09-26) — 셋 이상도 그대로 보낸다. */
    await act(async () => sheet('StylePickSheet').props.onConfirm(['NATURAL', 'GLAMOROUS', 'URBAN']));
    expect(jest.mocked(completeSetup).mock.calls.at(-1)?.[0]).toMatchObject({ styleTags: ['NATURAL', 'GLAMOROUS', 'URBAN'] });

    await act(async () => sheet('OptionWheelSheet', '준비 현황 선택').props.onConfirm('hall+sdm'));
    expect(jest.mocked(completeSetup).mock.calls.at(-1)?.[0]).toMatchObject({
      preparedCategories: ['hall', 'studio', 'dress', 'makeup', 'hair'],
    });

    await act(async () => sheet('RegionPickerSheet').props.onConfirm({ region: '경기', district: '성남시' }));
    expect(jest.mocked(completeSetup).mock.calls.at(-1)?.[0]).toMatchObject({ region: expect.stringContaining('성남') });

    await act(async () => sheet('DateWheelSheet').props.onConfirm('2027-10-09'));
    expect(jest.mocked(completeSetup).mock.calls.at(-1)?.[0]).toMatchObject({ weddingDate: '2027-10-09' });
    expect(visibleSheets()).toEqual([]);
  });

  it('닫기(✕ · 바깥)는 아무것도 저장하지 않는다', async () => {
    await mount();
    await act(async () => rows()[3]!.props.onPress());
    await act(async () => sheet('OptionWheelSheet', '예산 선택').props.onDismiss());

    expect(visibleSheets()).toEqual([]);
    expect(completeSetup).not.toHaveBeenCalled();
  });
});

describe('1열 휠 보기 — 온보딩 답 그대로', () => {
  it('예산 — 온보딩 여섯 구간', () => {
    expect(budgetOptions().map((option) => option.label)).toEqual([
      '500만원 이하',
      '500~1,000만원',
      '1,000~2,000만원',
      '2,000~3,000만원',
      '3,000만원 이상',
      '아직 모르겠어요',
    ]);
  });

  it('준비 현황 — «아직 시작 전이에요» + 카드 넷의 조합 열다섯', () => {
    const options = prepOptions();

    expect(options).toHaveLength(16);
    expect(options[0]).toEqual({ value: PREP_NONE_KEY, label: '아직 시작 전이에요' });
    expect(options.slice(1, 5).map((option) => option.label)).toEqual(['웨딩홀', '스드메', '본식', '예물 · 신혼']);
    expect(options.at(-1)?.label).toBe('웨딩홀 · 스드메 · 본식 · 예물 · 신혼');
    expect(prepCategoriesFromKey(PREP_NONE_KEY)).toEqual([]);
  });

  it('카드를 이루지 못한 옛 준비 현황은 칸을 짐작하지 않고, 값 줄에는 그대로 적는다', () => {
    expect(prepComboKeyOf(['studio'])).toBeNull();
    expect(prepValueLabel(['hall', 'studio'])).toBe('웨딩홀 · 스튜디오');
    expect(prepComboKeyOf([])).toBe(PREP_NONE_KEY);
    expect(prepValueLabel([])).toBe('아직 시작 전이에요');
  });
});
