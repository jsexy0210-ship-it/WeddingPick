/**
 * 이용 등급과 웨딩 미션. 디자인 핸드오프 17번.
 *
 * 등급은 **막는 장치가 아니라 보여주는 장치다.** 게스트도 검색·업체정보·인증후기·
 * 업체평가를 다 본다. 로그인이 필요한 곳은 우리웨딩과 결제내역 등록 둘뿐이고,
 * 실제로 잠기는 것은 실제 결제 구간 하나다.
 */

export const MEMBER_TIERS = ['guest', 'mate', 'friend', 'family'] as const;

export type MemberTier = (typeof MEMBER_TIERS)[number];

export const MEMBER_TIER_LABEL: Record<MemberTier, string> = {
  guest: '게스트',
  mate: '메이트',
  friend: '프렌드',
  family: '패밀리',
};

export type MembershipFacts = {
  loggedIn: boolean;
  spouseLinked: boolean;
  /** 업체가 매칭된 결제인증이 있는가. Level 3 Unlock과 같은 조건이다. */
  hasPaymentProof: boolean;
};

/**
 * 지금 등급.
 *
 * **위에서부터 본다.** 결제인증을 낸 사람은 배우자를 연결하지 않았어도 패밀리다 —
 * 핸드오프 표가 등급 조건을 그렇게 적었다.
 *
 * 등급 이름과 실제로 되는 일은 다르다는 것에 주의. 패밀리라도 배우자를 연결하지
 * 않았으면 공유는 안 된다 — 공유는 상대가 있어야 하는 일이지 등급이 여는 일이
 * 아니다. 등급은 **어디까지 왔는지를 보여주는 이름**이다.
 */
export function tierOf(facts: MembershipFacts): MemberTier {
  if (!facts.loggedIn) return 'guest';
  if (facts.hasPaymentProof) return 'family';
  if (facts.spouseLinked) return 'friend';

  return 'mate';
}

export const MISSION_KEYS = ['explore', 'organize', 'together', 'payment'] as const;

export type MissionKey = (typeof MISSION_KEYS)[number];

export type Mission = {
  key: MissionKey;
  title: string;
  description: string;
};

/** 핸드오프 17번이 문구까지 정했다. */
export const MISSIONS: readonly Mission[] = [
  {
    key: 'explore',
    title: '업체를 살펴봐요',
    description: '검색 · 업체정보 · 인증후기 · 업체평가',
  },
  {
    key: 'organize',
    title: '준비를 정리해요',
    description: '관심업체 · 지출내역 · 웨딩 스케줄',
  },
  {
    key: 'together',
    title: '배우자와 함께해요',
    description: '초대 코드로 배우자를 초대해보세요',
  },
  {
    key: 'payment',
    title: '결제 데이터를 확인해요',
    description: '결제 인증 시 모든 정보 확인 가능',
  },
];

/**
 * 미션이 끝났는가.
 *
 * **'업체를 살펴봐요'는 늘 완료다.** 앱을 연 것이 곧 그 미션이라, 조건을 붙이면
 * 첫 화면부터 못 한 일이 하나 있는 상태로 시작한다. 그건 안내가 아니라 잔소리다.
 *
 * 미션은 등급과 따로 센다. 결제인증만 내고 배우자를 연결하지 않은 사람은 패밀리
 * 등급이지만 '배우자와 함께해요'는 아직 안 한 것이다 — **등급이 미션을 대신
 * 채워주면 그 체크 표시는 거짓이 된다.**
 */
export function isMissionDone(key: MissionKey, facts: MembershipFacts): boolean {
  switch (key) {
    case 'explore':
      return true;
    case 'organize':
      return facts.loggedIn;
    case 'together':
      return facts.spouseLinked;
    case 'payment':
      return facts.hasPaymentProof;
  }
}

export function missionProgress(facts: MembershipFacts): { done: number; total: number } {
  return {
    done: MISSION_KEYS.filter((key) => isMissionDone(key, facts)).length,
    total: MISSION_KEYS.length,
  };
}

export function allMissionsDone(facts: MembershipFacts): boolean {
  return MISSION_KEYS.every((key) => isMissionDone(key, facts));
}

/** 미션을 다 마쳤을 때 한 번 뜨는 말. 핸드오프 18번. */
export const MISSION_COMPLETE_TITLE = '필수 미션을 모두 완료했어요';
export const MISSION_COMPLETE_BODY = '웨딩픽의 모든 기능을 이용해보세요.';
export const MISSION_COMPLETE_TAGS = ['업체 탐색', '준비 관리', '배우자 연결', '결제 비교'] as const;
