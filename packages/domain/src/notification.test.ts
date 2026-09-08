import {
  NOTIFICATION_CAP_EXEMPT_KINDS,
  NOTIFICATION_DAILY_CAP,
  NOTIFICATION_KINDS,
  NOTIFICATION_KIND_LABEL,
  NOTIFICATION_TOPICS,
  NOTIFICATION_TOPICS_ALWAYS,
  NOTIFICATION_TOPICS_IN_PROGRESS_ONLY,
  dependsOnCategoryProgress,
  hasUnread,
  isCappedNotification,
  notifiesInState,
  reachedDailyCap,
} from './notification';

describe('알림', () => {
  it('안 읽은 것이 있어야 점이 켜진다', () => {
    /*
     * 홈과 알림함이 같은 답을 내야 한다. 두 곳에서 각자 세면 점은 떠 있는데
     * 알림함은 비어 있는 상태가 생긴다.
     */
    expect(hasUnread({ unread: 0, total: 12 })).toBe(false);
    expect(hasUnread({ unread: 1, total: 12 })).toBe(true);
  });

  it('모든 종류에 사람이 읽는 이름이 있다', () => {
    // DB의 enum 값이 화면에 뜨는 일은 없어야 한다.
    for (const kind of NOTIFICATION_KINDS) {
      expect(NOTIFICATION_KIND_LABEL[kind].length).toBeGreaterThan(0);
    }
  });
});

describe('알림 범위 — SPEC 13.12', () => {
  it('하루 최대 2건이다', () => {
    expect(NOTIFICATION_DAILY_CAP).toBe(2);
    expect(reachedDailyCap(1)).toBe(false);
    expect(reachedDailyCap(2)).toBe(true);
  });

  it('주제마다 «항상»과 «진행 중 업종만» 중 하나에만 속한다', () => {
    const always: readonly string[] = NOTIFICATION_TOPICS_ALWAYS;
    const inProgress: readonly string[] = NOTIFICATION_TOPICS_IN_PROGRESS_ONLY;

    for (const topic of NOTIFICATION_TOPICS) {
      expect(always.includes(topic) && inProgress.includes(topic)).toBe(false);
    }
  });

  it('일정 · 제보 결과 · 배우자는 항상 간다', () => {
    expect(NOTIFICATION_TOPICS_ALWAYS).toEqual(['schedule', 'verification', 'partner']);
    expect(dependsOnCategoryProgress('schedule')).toBe(false);
  });

  it('Pick 후보 변화 · 금액 변경 · 혜택은 진행 중 업종에서만 간다', () => {
    for (const topic of ['pick_candidates', 'price_change', 'benefit'] as const) {
      expect(dependsOnCategoryProgress(topic)).toBe(true);
    }

    // 후보를 담고 아직 정하지 않은 동안만이다. 결정 완료·시작 전은 조용하다.
    expect(notifiesInState('picking')).toBe(true);
    expect(notifiesInState('decided')).toBe(false);
    expect(notifiesInState('before')).toBe(false);
  });

  it('일정 알림은 한도 예외다', () => {
    expect(isCappedNotification({ kind: 'notice', topic: 'schedule' })).toBe(false);
  });

  it('제보 결과와 배우자는 종류만으로 예외다', () => {
    expect(NOTIFICATION_CAP_EXEMPT_KINDS).toContain('verification');
    expect(NOTIFICATION_CAP_EXEMPT_KINDS).toContain('partner');
    expect(isCappedNotification({ kind: 'verification', topic: 'other' })).toBe(false);
    expect(isCappedNotification({ kind: 'partner', topic: 'other' })).toBe(false);
  });

  it('가격 변동 · 혜택 · 주제 모를 안내는 한도에 센다', () => {
    expect(isCappedNotification({ kind: 'notice', topic: 'price_change' })).toBe(true);
    expect(isCappedNotification({ kind: 'notice', topic: 'benefit' })).toBe(true);
    // 모르는 것을 예외로 두면 예외가 기본이 된다.
    expect(isCappedNotification({ kind: 'notice', topic: 'other' })).toBe(true);
  });
});
