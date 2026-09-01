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
  /** 예식일을 정했는가. 최소 온보딩이 받는 것이다. */
  weddingSet: boolean;
  /** 한 곳이라도 Pick했는가. */
  hasPick: boolean;
  /** 한 업종이라도 비교해봤는가. 비교할 수 있는 상태가 아니라 비교한 사실이다. */
  hasCompared: boolean;
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

/**
 * 미션 넷. 통합정책 v3.7 최신 §9가 다시 정했다.
 *
 * **결제내역 제보가 빠졌다.** 예전 넷은 마지막이 결제인증이었는데, 처음 온
 * 사람에게 영수증을 내라는 것은 활성화가 아니라 문턱이다. 대신 첫 Pick과
 * 비교해보기가 들어왔다 — 이 앱이 무엇을 하는 곳인지 몸으로 알게 하는 순서다.
 *
 * 미션은 가입 조건도 기능 잠금도 아니다. 안 해도 다 쓸 수 있다.
 */
export const MISSION_KEYS = ['setup', 'first_pick', 'compare', 'partner'] as const;

export type MissionKey = (typeof MISSION_KEYS)[number];

export type Mission = {
  key: MissionKey;
  title: string;
  description: string;
};

export const MISSIONS: readonly Mission[] = [
  {
    key: 'setup',
    title: '내 웨딩을 설정해요',
    description: '예식일과 지역을 알려주시면 맞춰서 찾아드려요',
  },
  {
    key: 'first_pick',
    title: '마음에 드는 곳을 Pick해요',
    description: '검색하다 마음에 드는 곳을 담아두세요',
  },
  {
    key: 'compare',
    title: '나란히 놓고 비교해요',
    description: '같은 업종에서 두 곳부터 견줘볼 수 있어요',
  },
  {
    key: 'partner',
    title: '배우자와 함께해요',
    description: '초대 코드로 배우자를 초대해보세요',
  },
];

/** 미션 진행률에 붙는 말. v3.7 §9가 이 꼴로 정했다. */
export const MISSION_HEADLINE = '웨딩픽 시작하기';

/**
 * 미션이 끝났는가.
 *
 * **첫 Pick으로 로그인했으면 그 미션은 이미 끝난 것이다**(v3.7 §9). 로그인
 * 화면을 지나온 이유가 Pick이었는데 Pick 미션이 안 끝나 있으면, 방금 한 일이
 * 없던 일이 된다.
 *
 * 미션은 등급과 따로 센다. 결제인증만 내고 배우자를 연결하지 않은 사람은 패밀리
 * 등급이지만 '배우자와 함께해요'는 아직 안 한 것이다 — **등급이 미션을 대신
 * 채워주면 그 체크 표시는 거짓이 된다.**
 */
export function isMissionDone(key: MissionKey, facts: MembershipFacts): boolean {
  switch (key) {
    case 'setup':
      return facts.weddingSet;
    case 'first_pick':
      return facts.hasPick;
    case 'compare':
      return facts.hasCompared;
    case 'partner':
      return facts.spouseLinked;
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
export const MISSION_COMPLETE_TAGS = ['업체 탐색', '준비 관리', '배우자 연결', '가격 비교'] as const;
