import { RETENTION_POLICY, VERIFICATION_POLICY } from './policy';
import {
  isDeadTokenError,
  isExpoPushToken,
  retentionAlertContent,
  retentionSummary,
  shouldAlert,
  verificationBacklogContent,
} from './retention-alert';

describe('푸시 본문', () => {
  it('건수만 담는다', () => {
    const content = retentionAlertContent(3, 2);

    expect(content.body).toBe('원본 3건을 지울 때가 됐습니다. 가장 오래된 것은 예정일이 2일 지났습니다.');
  });

  it('예정일 당일이면 지났다고 하지 않는다', () => {
    expect(retentionAlertContent(1, 0).body).toContain('오늘이 예정일입니다');
  });

  it('지울 것이 없으면 만들지 않는다', () => {
    expect(() => retentionAlertContent(0, 0)).toThrow();
  });

  it('사람이나 문서를 가리키는 말이 들어가지 않는다', () => {
    // 푸시는 잠금화면에 뜬다. 파기해야 할 개인정보를 알리려다 흘리면 안 된다.
    const content = retentionAlertContent(5, 10);
    const text = `${content.title} ${content.body}`;

    for (const forbidden of ['이름', '연락처', '주민번호', '@', '견적서', '계약서']) {
      expect(text).not.toContain(forbidden);
    }
  });
});

describe('언제 알릴지', () => {
  const now = new Date('2026-09-15T09:00:00Z');
  const reminderAfterHours = 24;

  it('처음이면 알린다', () => {
    expect(shouldAlert({ dueCount: 2, lastAlert: null, reminderAfterHours, now })).toEqual({
      send: true,
      reason: 'first',
    });
  });

  it('지울 것이 없으면 알리지 않는다', () => {
    expect(shouldAlert({ dueCount: 0, lastAlert: null, reminderAfterHours, now })).toEqual({
      send: false,
      reason: 'nothing_due',
    });
  });

  it('일이 늘면 곧바로 알린다', () => {
    const lastAlert = { dueCount: 2, sentAt: new Date('2026-09-15T08:00:00Z') };

    expect(shouldAlert({ dueCount: 3, lastAlert, reminderAfterHours, now })).toEqual({
      send: true,
      reason: 'grew',
    });
  });

  it('같은 말을 곧바로 다시 하지 않는다', () => {
    const lastAlert = { dueCount: 3, sentAt: new Date('2026-09-15T08:00:00Z') };

    expect(shouldAlert({ dueCount: 3, lastAlert, reminderAfterHours, now })).toEqual({
      send: false,
      reason: 'already_told',
    });
  });

  it('처리되지 않은 채 시간이 지나면 다시 알린다', () => {
    const lastAlert = { dueCount: 3, sentAt: new Date('2026-09-14T08:00:00Z') };

    expect(shouldAlert({ dueCount: 3, lastAlert, reminderAfterHours, now })).toEqual({
      send: true,
      reason: 'reminder',
    });
  });

  it('일이 줄면 알리지 않는다', () => {
    // 사람이 지우고 있다는 뜻이다. 방해할 이유가 없다.
    const lastAlert = { dueCount: 5, sentAt: new Date('2026-09-15T08:00:00Z') };

    expect(shouldAlert({ dueCount: 2, lastAlert, reminderAfterHours, now }).send).toBe(false);
  });
});

describe('토큰', () => {
  it('Expo 토큰만 받는다', () => {
    expect(isExpoPushToken('ExponentPushToken[abc123]')).toBe(true);
    expect(isExpoPushToken('ExpoPushToken[abc123]')).toBe(true);
    expect(isExpoPushToken('그냥 문자열')).toBe(false);
    expect(isExpoPushToken('ExponentPushToken[]')).toBe(false);
  });

  it('죽은 토큰 판단은 정해진 것만', () => {
    expect(isDeadTokenError('DeviceNotRegistered')).toBe(true);
    // 일시적 오류로 토큰을 끄면 그 기기는 다시는 알림을 못 받는다.
    expect(isDeadTokenError('MessageRateExceeded')).toBe(false);
  });
});

describe('요약 문구', () => {
  it('조사는 앞말을 보고 고른다', () => {
    // '1건가'가 되면 안 된다.
    expect(retentionSummary({ dueCount: 5, attentionCount: 1 })).toBe(
      '파기 예정 5건. 그중 1건이 손이 필요하다.'
    );
  });

  it('문제가 없으면 건수만 말한다', () => {
    expect(retentionSummary({ dueCount: 5, attentionCount: 0 })).toBe('파기 예정 5건.');
  });
});

describe('보관 정책', () => {
  it('원본은 30일 보관한다', () => {
    // 화면·약관·마이그레이션이 모두 이 값을 말한다. 여기서 바꾸면 그 셋도
    // 함께 고쳐야 한다 — 이 테스트는 그걸 잊지 않게 하려고 있다.
    expect(RETENTION_POLICY.originalDays).toBe(30);
  });
});

describe('심사 적체 알림', () => {
  it('접수 후 7일부터 밀린 것으로 본다', () => {
    // SQL 쪽에도 같은 값이 있다. 한쪽만 고치면 목록과 알림이 어긋난다.
    expect(VERIFICATION_POLICY.backlogDays).toBe(7);
  });

  it('건수와 왜 급한지를 담는다', () => {
    const content = verificationBacklogContent(3, 12);

    expect(content.body).toContain('3건');
    expect(content.body).toContain('12일째');
    // 심사가 밀리면 그 증빙 원본이 파기되지 않는다. 그 연결을 적어두지 않으면
    // "나중에 하지"가 되기 쉽다.
    expect(content.body).toContain('파기 일정');
  });

  it('사람이나 문서를 가리키는 말이 들어가지 않는다', () => {
    const content = verificationBacklogContent(5, 30);
    const text = `${content.title} ${content.body}`;

    for (const forbidden of ['이름', '연락처', '@', '견적서']) {
      expect(text).not.toContain(forbidden);
    }
  });

  it('밀린 것이 없으면 만들지 않는다', () => {
    expect(() => verificationBacklogContent(0, 0)).toThrow();
  });
});
