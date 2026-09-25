import React from 'react';
import { act, create, type ReactTestRenderer, type ReactTestRendererJSON } from 'react-test-renderer';
import { MyWeddingPrep, HomeBudget } from './home-summary';
import { ceremonyLine } from './hero';
import { homePrepCards } from './prep-groups';

jest.mock('./category-image', () => ({ CategoryImage: () => null }));

const render = (element: React.ReactElement) => {
  let view!: ReactTestRenderer;
  act(() => { view = create(element); });
  return view;
};
/** 표시되는 자식 문자열만 읽는다. 아이콘 SVG 좌표/스타일 수치를 문구로 세지 않는다. */
function renderedText(node: ReactTestRendererJSON | ReactTestRendererJSON[] | string | null): string {
  if (node === null) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(renderedText).join(' ');
  return (node.children ?? []).map(renderedText).join(' ');
}
const text = (view: ReactTestRenderer) => renderedText(view.toJSON());

describe('최신 홈·추천 연결', () => {
  it('히어로 예식 정보 줄은 RN 정본 home.jsx WP-HOME-001~003 세 상태를 따른다', () => {
    expect(ceremonyLine('2027-04-17', '테스트 웨딩홀')).toBe('2027년 4월 17일 (토) · 테스트 웨딩홀');
    expect(ceremonyLine('2027-01-15', null)).toBe('2027년 1월 15일 (금) · 장소는 아직이에요');
    expect(ceremonyLine('2027-01-15', null, true)).toBe('예식일만 정했어요 · 장소는 아직이에요');
    expect(ceremonyLine(null, null)).toBe('예식일 · 예식장 미정');
  });

  it('별점 검사는 SVG 좌표를 제외하되 실제 표시된 별점은 탐지한다', () => {
    const icon: ReactTestRendererJSON = { type: 'RNSVGPath', props: { d: 'M2 4.80739' }, children: null };
    const rating: ReactTestRendererJSON = { type: 'Text', props: {}, children: ['4.8'] };
    expect(renderedText(icon)).not.toContain('4.8');
    expect(renderedText([icon, rating])).toContain('4.8');
  });
  const views: ReactTestRenderer[] = [];
  const mount = (element: React.ReactElement) => { const view = render(element); views.push(view); return view; };
  afterEach(() => { act(() => { views.splice(0).forEach((view) => view.unmount()); }); });

  it('「내 웨딩 준비」는 완료해도 사라지지 않고 항상 4칸이다', () => {
    const statuses = ['hall', 'studio', 'dress', 'makeup', 'hair', 'snap', 'bouquet', 'invitation', 'goods', 'dowry', 'honeymoon']
      .map((category) => ({ category: category as never, label: category, state: 'before' as const, pickCount: 0, decidedName: null }));
    const cards = homePrepCards({
      statuses: statuses.map((row) => row.category === 'hall' ? { ...row, state: 'decided' as const } : row),
      venueName: '테스트 웨딩홀',
    });

    expect(cards).toHaveLength(4);
    const hallCard = cards.find((card) => card.key === 'start')!;
    expect(hallCard.label).toBe('웨딩홀');
    expect(hallCard.state).toBe('contracted');
    expect(hallCard.detail).toBe('계약 완료 · 테스트 웨딩홀');

    const view = mount(<MyWeddingPrep cards={cards} sub="지금은 스튜디오 차례예요" onOpen={jest.fn()} onMore={jest.fn()} />);
    expect(text(view)).toContain('웨딩홀');
    expect(text(view)).toContain('계약 완료 · 테스트 웨딩홀');
    expect(text(view)).toContain('아직 정하지 않았어요');
    expect(view.root.findAllByProps({ accessibilityLabel: '웨딩홀' }).length).toBeGreaterThan(0);
  });

  it('예산이 없어도 예산현황을 그대로 그리고 서브 문구로 입력을 안내한다(2026-09-25 대표 지시)', () => {
    const view = mount(<HomeBudget budget={{ total: 0, spent: 0, remaining: 0 }} onOpen={jest.fn()} />);
    expect(text(view)).toContain('예산 정보를 입력해 주세요');
    expect(text(view)).toContain('예산 미입력');
    expect(view.root.findAllByProps({ accessibilityRole: 'progressbar' })).not.toHaveLength(0);

    const empty = mount(<HomeBudget budget={null} onOpen={jest.fn()} />);
    expect(text(empty)).toContain('예산 정보를 입력해 주세요');
  });

  it('예산만 있고 쓴 돈이 없으면 WP-HOME-002 문구를 보여 준다', () => {
    const view = mount(<HomeBudget budget={{ total: 17_500_000, spent: 0, remaining: 17_500_000 }} onOpen={jest.fn()} />);
    expect(text(view)).toContain('온보딩에서 등록한 예산이에요');
    expect(text(view)).toContain('아직 예산 정보가 없어요');
    expect(text(view)).toContain('0%');
  });

  it('예산 초과는 100%로 제한한 진행 막대와 초과 안내를 표시한다', () => {
    const view = mount(<HomeBudget budget={{ total: 100, spent: 150, remaining: -50 }} onOpen={jest.fn()} />);
    expect(text(view)).toContain('예산을 넘었어요');
    const bar = view.root.findAllByProps({ accessibilityRole: 'progressbar' })[0];
    expect(bar!.props.accessibilityValue).toEqual({ min: 0, max: 100, now: 100 });
  });
});
