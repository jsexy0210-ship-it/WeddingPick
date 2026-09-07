import type { CurrentUser } from '@weddingpick/api-contract';
import { createContext, useContext, type ReactNode } from 'react';

const SessionMemberContext = createContext<CurrentUser | null>(null);

/** 같은 서버 응답이면 기존 객체를 유지해 소비 화면의 불필요한 재요청을 막는다. */
export function retainSessionMember(
  current: CurrentUser | null,
  next: CurrentUser | null
): CurrentUser | null {
  if (current === next) return current;
  if (current === null || next === null) return next;

  const unchanged =
    current.userId === next.userId &&
    current.weddingId === next.weddingId &&
    current.displayName === next.displayName &&
    current.weddingDate === next.weddingDate &&
    current.region === next.region &&
    current.budgetAmount === next.budgetAmount &&
    current.setupComplete === next.setupComplete &&
    current.spouseLinked === next.spouseLinked &&
    current.hasPaymentProof === next.hasPaymentProof &&
    current.hasPick === next.hasPick &&
    current.hasCompared === next.hasCompared &&
    current.tier === next.tier &&
    current.tierLabel === next.tierLabel;

  return unchanged ? current : next;
}

/**
 * 진입 게이트가 이미 확인한 회원 정보다.
 *
 * 홈에서 같은 `/v1/me`를 다시 부르지 않도록 앱 트리 안에서 공유한다. 세션이
 * 바뀌거나 앱이 전면으로 돌아오면 `_layout`이 다시 확인해 이 값을 교체한다.
 */
export function SessionMemberProvider({
  member,
  children,
}: {
  member: CurrentUser | null;
  children: ReactNode;
}) {
  return (
    <SessionMemberContext.Provider value={member}>
      {children}
    </SessionMemberContext.Provider>
  );
}

export function useSessionMember(): CurrentUser | null {
  return useContext(SessionMemberContext);
}
