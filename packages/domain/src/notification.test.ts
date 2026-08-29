import { NOTIFICATION_KINDS, NOTIFICATION_KIND_LABEL, hasUnread } from './notification';

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
