import type { CategoryRecommendation } from '@weddingpick/api-contract';
import type { VendorCategory } from '@weddingpick/domain';
import React from 'react';
import { Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { useOpenCategory } from './use-open-category';

/**
 * 「완료 → 다음 추천 자동 승격」(대표 사양 §8)이 실제로 도는지 본다.
 *
 * 글로 적어 두면 깨진다. 이 규칙은 **업종을 정하는 순간에만** 드러나서, 화면을 한 번 보는
 * 것으로는 확인되지 않는다 — 웨딩홀을 정하고 홈으로 돌아와야 나타난다.
 */
const group = (category: VendorCategory): CategoryRecommendation => ({
  category,
  categoryLabel: category,
  state: 'NOT_STARTED',
  pickCount: 0,
  vendors: [],
});

function Probe({
  groups,
  preferred = null,
  onReady,
}: {
  groups: readonly CategoryRecommendation[];
  preferred?: VendorCategory | null;
  onReady: (api: { open: VendorCategory | null; toggle: (c: VendorCategory) => void }) => void;
}) {
  const api = useOpenCategory(groups, preferred);
  onReady(api);

  return <Text>{api.open ?? 'none'}</Text>;
}

function setup(groups: readonly CategoryRecommendation[], preferred: VendorCategory | null = null) {
  let api!: { open: VendorCategory | null; toggle: (c: VendorCategory) => void };
  let view!: ReactTestRenderer;

  act(() => {
    view = create(<Probe groups={groups} preferred={preferred} onReady={(next) => (api = next)} />);
  });

  return {
    get open() {
      return api.open;
    },
    toggle: (category: VendorCategory) => act(() => api.toggle(category)),
    setGroups: (next: readonly CategoryRecommendation[]) =>
      act(() => {
        view.update(<Probe groups={next} preferred={preferred} onReady={(value) => (api = value)} />);
      }),
  };
}

describe('useOpenCategory', () => {
  it('첫 진입에는 첫 업종이 펼쳐진다 (§5)', () => {
    const view = setup([group('hall'), group('studio'), group('makeup')]);

    expect(view.open).toBe('hall');
  });

  it('요청 업종이 있으면 목록 순서보다 요청 업종을 먼저 펼친다', () => {
    const view = setup([group('hall'), group('studio'), group('makeup')], 'studio');

    expect(view.open).toBe('studio');
  });

  it('목록에 없는 요청 업종은 첫 업종으로 안전하게 되돌린다', () => {
    const view = setup([group('hall'), group('studio')], 'makeup');

    expect(view.open).toBe('hall');
  });

  it('다른 업종을 누르면 그것만 펼쳐진다 — 한 번에 하나다 (§5)', () => {
    const view = setup([group('hall'), group('studio')]);

    view.toggle('studio');

    expect(view.open).toBe('studio');
  });

  it('펼친 것을 다시 누르면 접힌다', () => {
    const view = setup([group('hall'), group('studio')]);

    view.toggle('hall');

    expect(view.open).toBeNull();
  });

  /*
   * 여기가 §8이다. 웨딩홀을 정하면 서버가 그 업종을 빼고 내려주고, 스튜디오가 첫째가 되며
   * **그 아코디언이 저절로 펼쳐진다.** 승격을 따로 시키는 코드가 없다는 것이 요점이다.
   */
  it('업종을 정해 목록에서 빠지면 다음 업종이 자동으로 펼쳐진다 (§8)', () => {
    const view = setup([group('hall'), group('studio'), group('makeup')]);
    expect(view.open).toBe('hall');

    view.setGroups([group('studio'), group('makeup'), group('dress')]);

    expect(view.open).toBe('studio');
  });

  it('접어둔 상태에서도 승격되면 다시 펼쳐진다 — 접힘은 그 목록에만 유효하다 (§8)', () => {
    const view = setup([group('hall'), group('studio')]);
    view.toggle('hall');
    expect(view.open).toBeNull();

    view.setGroups([group('studio'), group('dress')]);

    expect(view.open).toBe('studio');
  });

  it('목록이 그대로면 사용자가 고른 업종을 유지한다 — 다시 받아왔다고 되돌리지 않는다', () => {
    const groups = [group('hall'), group('studio'), group('makeup')];
    const view = setup(groups);
    view.toggle('makeup');

    view.setGroups([...groups]);

    expect(view.open).toBe('makeup');
  });

  it('정할 것이 없으면 펼칠 것도 없다', () => {
    const view = setup([]);

    expect(view.open).toBeNull();
  });
});
