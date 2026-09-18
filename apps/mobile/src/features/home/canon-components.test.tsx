import type { CategoryRecommendation, VendorSummary } from '@weddingpick/api-contract';
import React from 'react';
import { act, create, type ReactTestRenderer, type ReactTestRendererJSON } from 'react-test-renderer';
import { PendingPreparation, HomeBudget } from './home-summary';
import { HomeRecommendations, PickRecommend } from './pick-recommend';
import { VendorCard } from './vendor-card';

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

const group: CategoryRecommendation = {
  category: 'studio', categoryLabel: '스튜디오', state: 'NOT_STARTED', pickCount: 0, vendors: [],
};

const vendor: VendorSummary = {
  id: 'vendor-1', name: '테스트 업체', category: 'studio', region: '서울',
  coordinates: null, imageUrl: null, sourceNote: null, comparableQuoteCount: 0,
  paidPrice: { stage: 'collecting', count: 0, caption: '아직 정보가 적어요' },
  guidePrice: { fromKrw: 1500000, sourceLabel: '업체 홈페이지' },
  styleTags: [], reasons: ['선호하는 분위기가 같아요'], rating: { average: 4.8, count: 10 },
};

const groupWithVendor: CategoryRecommendation = {
  ...group,
  vendors: [vendor],
};

describe('최신 홈·추천 연결', () => {
  it('별점 검사는 SVG 좌표를 제외하되 실제 표시된 별점은 탐지한다', () => {
    const icon: ReactTestRendererJSON = { type: 'RNSVGPath', props: { d: 'M2 4.80739' }, children: null };
    const rating: ReactTestRendererJSON = { type: 'Text', props: {}, children: ['4.8'] };
    expect(renderedText(icon)).not.toContain('4.8');
    expect(renderedText([icon, rating])).toContain('4.8');
  });
  const views: ReactTestRenderer[] = [];
  const mount = (element: React.ReactElement) => { const view = render(element); views.push(view); return view; };
  afterEach(() => { act(() => { views.splice(0).forEach((view) => view.unmount()); }); });

  it('홈 추천은 아코디언 대신 첫 업종 카드와 비교 CTA를 바로 보여준다', () => {
    const onCompare = jest.fn();
    const view = mount(<HomeRecommendations groups={[groupWithVendor]} isPicked={() => false}
      onPressVendor={jest.fn()} onPressPick={jest.fn()} onPressCompare={onCompare} onPressMore={jest.fn()} />);
    expect(text(view)).toContain('웨딩픽 추천');
    expect(text(view)).toContain('테스트 업체');
    expect(text(view)).toContain('선호하는 분위기가 같아요');
    expect(view.root.findAllByProps({ accessibilityState: { expanded: true } })).toHaveLength(0);
  });

  it('추천 전체는 기본 카드에서 이유를 숨기고 카드를 누르면 이유 확장 상태로 교체한다', () => {
    const view = mount(<PickRecommend groups={[groupWithVendor]} open="studio" onToggle={jest.fn()}
      remaining={1} remainingCategories={[]} isPicked={() => false} onPressVendor={jest.fn()}
      onPressPick={jest.fn()} onPressCompare={jest.fn()} onPressMore={jest.fn()}
      onPressSearchMore={jest.fn()} />);

    expect(text(view)).not.toContain('추천 1위');
    expect(text(view)).not.toContain('선호하는 분위기가 같아요');

    const card = view.root.findAllByProps({ accessibilityLabel: '테스트 업체 추천 이유 보기' })
      .find((node) => typeof node.props.onPress === 'function');
    expect(card).toBeDefined();
    act(() => { card!.props.onPress(); });

    expect(text(view)).toContain('추천 1위');
    expect(text(view)).toContain('선호하는 분위기가 같아요');
    expect(text(view)).toMatch(/실 제보\s*0\s*건/);
    expect(text(view)).toContain('비교에 담기');
    expect(view.root.findAllByProps({ accessibilityLabel: '스튜디오 더 찾아보기' })).toHaveLength(0);
  });

  it('업체가 없는 업종도 더 찾아보기를 열 수 있다', () => {
    const onMore = jest.fn();
    const view = mount(<PickRecommend groups={[group]} open="studio" onToggle={jest.fn()}
      remaining={1} remainingCategories={[]} isPicked={() => false} onPressVendor={jest.fn()}
      onPressPick={jest.fn()} onPressCompare={jest.fn()} onPressMore={jest.fn()} onPressSearchMore={onMore} />);
    const button = view.root.findAllByProps({ accessibilityLabel: '스튜디오 더 찾아보기' })
      .find((node) => typeof node.props.onPress === 'function');
    expect(button).toBeDefined();
    act(() => { button!.props.onPress(); });
    expect(onMore).toHaveBeenCalledWith('studio');
  });

  it('접힌 업종의 검색 버튼을 중복 노출하지 않는다', () => {
    const view = mount(<PickRecommend groups={[group]} open={null} onToggle={jest.fn()}
      remaining={1} remainingCategories={[]} isPicked={() => false} onPressVendor={jest.fn()}
      onPressPick={jest.fn()} onPressCompare={jest.fn()} onPressMore={jest.fn()} onPressSearchMore={jest.fn()} />);
    expect(view.root.findAllByProps({ accessibilityLabel: '스튜디오 더 찾아보기' })).toHaveLength(0);
  });

  it('추천이 비어도 남은 준비가 있으면 완료라고 하지 않는다', () => {
    const view = mount(<PickRecommend groups={[]} open={null} onToggle={jest.fn()}
      remaining={2} remainingCategories={[]} isPicked={() => false} onPressVendor={jest.fn()}
      onPressPick={jest.fn()} onPressCompare={jest.fn()} onPressMore={jest.fn()} />);
    expect(text(view)).toContain('정보 수집 중');
    expect(text(view)).not.toContain('정할 준비를 다 끝냈어요');
  });

  it('제보 부족은 수집 중으로 표시하고 별점을 제보 건수로 혼용하지 않는다', () => {
    const view = mount(<VendorCard vendor={vendor} picked={false} onPress={jest.fn()} onPressPick={jest.fn()} />);
    expect(text(view)).toContain('수집 중');
    expect(text(view)).toContain('선호하는 분위기가 같아요');
    expect(text(view)).not.toContain('업체 안내 150만원');
    expect(text(view)).not.toContain('4.8');
    expect(text(view)).toMatch(/0\s*건/);
  });

  it('Pick 버튼은 상위 상세 이동 이벤트를 차단한다', () => {
    const onPick = jest.fn(), onDetail = jest.fn(), stopPropagation = jest.fn();
    const view = mount(<VendorCard vendor={vendor} picked={false} onPress={onDetail} onPressPick={onPick} />);
    const button = view.root.findAllByProps({ accessibilityLabel: '테스트 업체 Pick' })
      .find((node) => typeof node.props.onPress === 'function');
    act(() => { button!.props.onPress({ stopPropagation }); });
    expect(stopPropagation).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onDetail).not.toHaveBeenCalled();
  });

  it('완료한 준비는 카드에서 제외하고 다음 업종으로 바꾼다', () => {
    const view = mount(<PendingPreparation statuses={[
      { category: 'hall', label: '웨딩홀', state: 'decided', pickCount: 1, decidedName: '정한 업체' },
      { category: 'studio', label: '스튜디오', state: 'picking', pickCount: 2, decidedName: null },
    ]} onOpen={jest.fn()} onMore={jest.fn()} onComplete={jest.fn()} />);
    expect(text(view)).not.toContain('정한 업체');
    expect(text(view)).toContain('후보 2곳 담김');
    expect(view.root.findAllByProps({ accessibilityLabel: '웨딩홀' })).toHaveLength(0);
  });

  it('예산이 0이면 0%로 오해시키지 않고 설정 행동을 준다', () => {
    const view = mount(<HomeBudget budget={{ total: 0, spent: 0, remaining: 0 }} onOpen={jest.fn()} />);
    expect(text(view)).toContain('예산 정하기');
    expect(view.root.findAllByProps({ accessibilityRole: 'progressbar' })).toHaveLength(0);
  });

  it('예산 초과는 100%로 제한한 진행 막대와 초과 안내를 표시한다', () => {
    const view = mount(<HomeBudget budget={{ total: 100, spent: 150, remaining: -50 }} onOpen={jest.fn()} />);
    expect(text(view)).toContain('예산을 넘었어요');
    const bar = view.root.findAllByProps({ accessibilityRole: 'progressbar' })[0];
    expect(bar!.props.accessibilityValue).toEqual({ min: 0, max: 100, now: 100 });
  });
});
