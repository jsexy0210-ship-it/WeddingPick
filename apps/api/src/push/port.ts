export type PushMessage = {
  token: string;
  title: string;
  body: string;
};

export type PushOutcome =
  | { token: string; delivered: true }
  | { token: string; delivered: false; error: string };

/**
 * 푸시 발송.
 *
 * 저장소(Storage)와 같은 이유로 포트를 둔다 — 테스트가 진짜 기기로 알림을 쏘지
 * 않아야 하고, 나중에 Expo 말고 다른 곳으로 옮길 수 있어야 한다.
 */
export type Push = {
  send(messages: readonly PushMessage[]): Promise<PushOutcome[]>;
};
