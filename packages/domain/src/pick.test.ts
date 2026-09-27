import {
  CategoryProgress,
  MIN_COMPARABLE,
  PREPARATION_STATE_LABEL,
  canCompare,
  completedPreparationGroups,
  decidedCategories,
  nextCategory,
  pickOwner,
  preparationProgress,
} from './pick';

const row = (over: Partial<CategoryProgress> & Pick<CategoryProgress, 'category' | 'state'>) =>
  ({
    label: '',
    pickCount: 0,
    decidedVendorId: null,
    ...over,
  }) as CategoryProgress;

describe('Pick', () => {
  describe('누가 Pick했는가', () => {
    it('내가 담았으면 내 Pick이다', () => {
      expect(pickOwner({ addedBy: 'me', viewerId: 'me' })).toBe('mine');
    });

    it('배우자가 담았으면 배우자 Pick이다', () => {
      expect(pickOwner({ addedBy: 'spouse', viewerId: 'me' })).toBe('spouse');
    });

    it('둘 다 담으려 했으면 둘 다 Pick이다', () => {
      /*
       * 두 사람이 같은 곳을 마음에 들어 했다는 사실이 남아야 한다. 그게 대화를
       * 시작하기 가장 좋은 자리인데, 각자 담은 것만 구분하면 어디에도 안 남는다.
       */
      expect(pickOwner({ addedBy: 'spouse', secondPickerId: 'me', viewerId: 'me' })).toBe('both');
    });

    it('같은 사람이 두 번 눌러도 둘 다가 되지 않는다', () => {
      expect(pickOwner({ addedBy: 'me', secondPickerId: 'me', viewerId: 'me' })).toBe('mine');
    });

    it('담은 사람을 모르면 배우자 쪽으로 둔다', () => {
      // 내가 담았다고 우기지 않는다. 내 것이라고 잘못 말하는 쪽이 더 나쁘다.
      expect(pickOwner({ addedBy: null, viewerId: 'me' })).toBe('spouse');
    });
  });

  describe('비교', () => {
    it('두 곳부터 비교할 수 있다', () => {
      expect(MIN_COMPARABLE).toBe(2);
      expect(canCompare(1)).toBe(false);
      expect(canCompare(2)).toBe(true);
    });
  });

  describe('다음 준비', () => {
    it('담다 만 업종을 먼저 권한다', () => {
      /*
       * 이미 고르기 시작한 일을 끝내는 것이, 손대지 않은 일을 새로 여는 것보다
       * 사용자에게 가깝다.
       */
      const next = nextCategory([
        row({ category: 'hall', state: 'before' }),
        row({ category: 'snap', state: 'picking', pickCount: 2 }),
      ]);

      expect(next).toBe('snap');
    });

    it('담다 만 것이 없으면 시작하지 않은 업종을 권한다', () => {
      const next = nextCategory([
        row({ category: 'hall', state: 'decided', decidedVendorId: 'v1' }),
        row({ category: 'snap', state: 'before' }),
      ]);

      expect(next).toBe('snap');
    });

    it('다 정했으면 다음을 지어내지 않는다', () => {
      const next = nextCategory([
        row({ category: 'hall', state: 'decided', decidedVendorId: 'v1' }),
        row({ category: 'snap', state: 'decided', decidedVendorId: 'v2' }),
      ]);

      expect(next).toBeNull();
    });
  });

  describe('진행률', () => {
    it('분모는 업종 수다', () => {
      /*
       * 담은 후보 수를 분모로 쓰면 많이 담을수록 진행률이 떨어진다. 그건 열심히
       * 한 사람을 벌주는 셈이다.
       */
      const progress = preparationProgress([
        row({ category: 'hall', state: 'decided', decidedVendorId: 'v1' }),
        row({ category: 'snap', state: 'picking', pickCount: 9 }),
        row({ category: 'studio', state: 'before' }),
      ]);

      expect(progress).toEqual({ decided: 1, total: 3, label: '1/3 완료' });
    });
  });

  describe('상태 이름', () => {
    it('세 가지가 정책이 적은 말과 같다', () => {
      expect(PREPARATION_STATE_LABEL).toEqual({
        before: '준비전',
        picking: '후보 Pick 중',
        decided: '결정완료',
      });
    });
  });
});

describe('완료 판정 — 실제 결정 하나(2026-09-26 대표 결정 A · 「결정 후 완료로 진행」)', () => {
  const HALL = '11111111-1111-4111-8111-111111111111';

  it('업체로 정한 곳과 이름으로 정한 곳만 센다 — 후보만 담은 업종은 아니다', () => {
    const decided = decidedCategories({
      groups: [
        { category: 'hall', decidedVendorId: HALL },
        { category: 'dress', decidedVendorId: null },
      ],
      manualDecisions: [{ category: 'studio' }],
    });

    expect([...decided].sort()).toEqual(['hall', 'studio']);
  });

  it('출처가 없으면 정한 업종도 없다 — 준비 현황은 받는 칸이 없다', () => {
    expect(decidedCategories(null).size).toBe(0);
    expect(decidedCategories({}).size).toBe(0);
  });

  it('묶음은 업종이 모두 정해져야 끝난다 — 스드메는 넷', () => {
    expect([...completedPreparationGroups(new Set(['hall']))]).toEqual(['start']);
    expect(completedPreparationGroups(new Set(['studio', 'dress', 'makeup'])).has('sdm')).toBe(false);
    expect(completedPreparationGroups(new Set(['studio', 'dress', 'makeup', 'hair'])).has('sdm')).toBe(true);
  });

  it('결정을 취소하면(decidedVendorId null) 곧바로 풀린다', () => {
    const before = decidedCategories({ groups: [{ category: 'hall', decidedVendorId: HALL }] });
    const after = decidedCategories({ groups: [{ category: 'hall', decidedVendorId: null }] });

    expect(completedPreparationGroups(before).has('start')).toBe(true);
    expect(completedPreparationGroups(after).has('start')).toBe(false);
  });
});
