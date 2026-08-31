import {
  MEMBER_TIERS,
  MEMBER_TIER_LABEL,
  MISSIONS,
  MISSION_KEYS,
  allMissionsDone,
  isMissionDone,
  missionProgress,
  tierOf,
  type MembershipFacts,
} from './membership';

/** 아무것도 안 한 상태. 필요한 것만 바꿔 쓴다. */
const NOTHING: MembershipFacts = {
  loggedIn: false,
  spouseLinked: false,
  hasPaymentProof: false,
  weddingSet: false,
  hasPick: false,
  hasCompared: false,
};

const facts = (over: Partial<MembershipFacts>): MembershipFacts => ({ ...NOTHING, ...over });

const guest = NOTHING;
const mate = facts({ loggedIn: true });
const friend = facts({ loggedIn: true, spouseLinked: true });
const family = facts({ loggedIn: true, spouseLinked: true, hasPaymentProof: true });

describe('등급', () => {
  it('네 단계를 순서대로 매긴다', () => {
    expect(tierOf(guest)).toBe('guest');
    expect(tierOf(mate)).toBe('mate');
    expect(tierOf(friend)).toBe('friend');
    expect(tierOf(family)).toBe('family');
  });

  it('로그인하지 않았으면 다른 조건을 보지 않는다', () => {
    /*
     * 로그인 전에는 결제인증도 배우자 연결도 있을 수 없지만, 사실이 그렇게 들어와도
     * 게스트여야 한다. 등급은 로그인한 사람에게 붙는 이름이다.
     */
    expect(tierOf(facts({ spouseLinked: true, hasPaymentProof: true }))).toBe('guest');
  });

  it('결제인증이 있으면 배우자를 연결하지 않았어도 패밀리다', () => {
    expect(tierOf(facts({ loggedIn: true, hasPaymentProof: true }))).toBe('family');
  });

  it('모든 등급에 이름이 있다', () => {
    for (const tier of MEMBER_TIERS) {
      expect(MEMBER_TIER_LABEL[tier].length).toBeGreaterThan(0);
    }
  });
});

describe('미션', () => {
  it('결제내역 제보는 미션이 아니다', () => {
    /*
     * v3.7 §9가 뺐다. 처음 온 사람에게 영수증을 내라는 것은 활성화가 아니라
     * 문턱이다.
     */
    expect([...MISSION_KEYS]).toEqual(['setup', 'first_pick', 'compare', 'partner']);
    expect(MISSION_KEYS).not.toContain('payment');
  });

  it('아무것도 안 했으면 0/4다', () => {
    // 앱을 연 것만으로 채워주는 미션은 없다. 넷 다 실제로 하는 일이다.
    expect(missionProgress(guest)).toEqual({ done: 0, total: 4 });
  });

  it('하나씩 채우면 하나씩 늘어난다', () => {
    expect(missionProgress(facts({ weddingSet: true }))).toEqual({ done: 1, total: 4 });
    expect(missionProgress(facts({ weddingSet: true, hasPick: true }))).toEqual({
      done: 2,
      total: 4,
    });
    expect(
      missionProgress(facts({ weddingSet: true, hasPick: true, hasCompared: true }))
    ).toEqual({ done: 3, total: 4 });
  });

  it('비교할 수 있는 것과 비교한 것은 다르다', () => {
    /*
     * 후보 두 곳을 담았다고 비교한 것은 아니다. 버튼이 옆에 있는 것과 눌러본
     * 것은 다르고, 미션은 눌러보게 하려고 있는 장치다.
     */
    expect(isMissionDone('compare', facts({ hasPick: true }))).toBe(false);
    expect(isMissionDone('compare', facts({ hasPick: true, hasCompared: true }))).toBe(true);
  });

  it('등급이 미션을 대신 채워주지 않는다', () => {
    /*
     * 결제인증만 낸 사람은 패밀리지만 배우자 연결은 아직 안 한 것이다. 등급으로
     * 체크 표시를 채우면 그 표시가 거짓이 된다.
     */
    const paidAlone: MembershipFacts = facts({ loggedIn: true, hasPaymentProof: true });

    expect(tierOf(paidAlone)).toBe('family');
    expect(isMissionDone('partner', paidAlone)).toBe(false);
    expect(allMissionsDone(paidAlone)).toBe(false);
  });

  it('다 마쳤을 때만 완료다', () => {
    const all = facts({
      loggedIn: true,
      weddingSet: true,
      hasPick: true,
      hasCompared: true,
      spouseLinked: true,
    });

    expect(allMissionsDone(guest)).toBe(false);
    expect(allMissionsDone(family)).toBe(false);
    expect(allMissionsDone(all)).toBe(true);
  });

  it('미션 목록과 키가 어긋나지 않는다', () => {
    expect(MISSIONS.map((mission) => mission.key)).toEqual([...MISSION_KEYS]);
  });
});
