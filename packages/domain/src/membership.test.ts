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

const guest: MembershipFacts = { loggedIn: false, spouseLinked: false, hasPaymentProof: false };
const mate: MembershipFacts = { loggedIn: true, spouseLinked: false, hasPaymentProof: false };
const friend: MembershipFacts = { loggedIn: true, spouseLinked: true, hasPaymentProof: false };
const family: MembershipFacts = { loggedIn: true, spouseLinked: true, hasPaymentProof: true };

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
    expect(tierOf({ loggedIn: false, spouseLinked: true, hasPaymentProof: true })).toBe('guest');
  });

  it('결제인증이 있으면 배우자를 연결하지 않았어도 패밀리다', () => {
    expect(tierOf({ loggedIn: true, spouseLinked: false, hasPaymentProof: true })).toBe('family');
  });

  it('모든 등급에 이름이 있다', () => {
    for (const tier of MEMBER_TIERS) {
      expect(MEMBER_TIER_LABEL[tier].length).toBeGreaterThan(0);
    }
  });
});

describe('미션', () => {
  it('업체를 살펴보는 미션은 늘 완료다', () => {
    /*
     * 조건을 붙이면 앱을 처음 연 사람이 못 한 일 하나를 가진 채로 시작한다.
     */
    expect(isMissionDone('explore', guest)).toBe(true);
    expect(isMissionDone('explore', family)).toBe(true);
  });

  it('게스트도 하나는 마친 상태로 시작한다', () => {
    expect(missionProgress(guest)).toEqual({ done: 1, total: 4 });
  });

  it('한 단계씩 늘어난다', () => {
    expect(missionProgress(mate)).toEqual({ done: 2, total: 4 });
    expect(missionProgress(friend)).toEqual({ done: 3, total: 4 });
    expect(missionProgress(family)).toEqual({ done: 4, total: 4 });
  });

  it('등급이 미션을 대신 채워주지 않는다', () => {
    /*
     * 결제인증만 낸 사람은 패밀리지만 '배우자와 함께해요'는 아직 안 한 것이다.
     * 등급으로 체크 표시를 채우면 그 표시가 거짓이 된다.
     */
    const paidAlone: MembershipFacts = { loggedIn: true, spouseLinked: false, hasPaymentProof: true };

    expect(tierOf(paidAlone)).toBe('family');
    expect(isMissionDone('together', paidAlone)).toBe(false);
    expect(allMissionsDone(paidAlone)).toBe(false);
  });

  it('다 마쳤을 때만 완료다', () => {
    expect(allMissionsDone(guest)).toBe(false);
    expect(allMissionsDone(friend)).toBe(false);
    expect(allMissionsDone(family)).toBe(true);
  });

  it('미션 목록과 키가 어긋나지 않는다', () => {
    expect(MISSIONS.map((mission) => mission.key)).toEqual([...MISSION_KEYS]);
  });
});
