export type User = {
  id: string;
  createdAt: string;
  deletedAt: string | null;
};

/**
 * 하나의 결혼 준비 단위. 배우자 연결 전에는 "내 웨딩", 연결 후에는 "우리 웨딩"이다.
 * 사업계획서 12번.
 */
export type Wedding = {
  id: string;
  ownerUserId: string;
  /** 배우자 연결 전에는 없다. 해제하면 다시 null이 된다. */
  partnerUserId: string | null;
  /** ISO 8601 날짜 */
  weddingDate: string | null;
  createdAt: string;
};

/** 각자 후보에 남기는 의견. 사업계획서 13번. */
export type CandidateOpinion = 'preferred' | 'hold' | 'excluded';

/** 두 사람의 의견을 합친 결과. */
export type SharedOpinion = 'both_preferred' | 'disagreed' | 'both_excluded' | 'undecided';

/**
 * 부부 공동 의사결정. 사업계획서 13번.
 * 한쪽만 의견을 냈으면 아직 결론이 아니다.
 */
export function combineOpinions(
  owner: CandidateOpinion | null,
  partner: CandidateOpinion | null
): SharedOpinion {
  if (!owner || !partner) return 'undecided';
  if (owner === 'preferred' && partner === 'preferred') return 'both_preferred';
  if (owner === 'excluded' && partner === 'excluded') return 'both_excluded';
  if (owner === partner) return 'undecided';
  return 'disagreed';
}
