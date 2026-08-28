import type { Push, PushMessage, PushOutcome } from './port';

/**
 * Expo 푸시.
 *
 * Expo가 APNs·FCM 자격증명을 대신 들고 있어, 우리는 토큰과 본문만 넘긴다.
 * 아직 정해지지 않은 값(팀 계정, 인증서)을 지어내지 않고 시작할 수 있는 유일한
 * 경로여서 이걸 쓴다. 나중에 직접 붙이더라도 Push 포트는 그대로다.
 *
 * https://docs.expo.dev/push-notifications/sending-notifications/
 */

const ENDPOINT = 'https://exp.host/--/api/v2/push/send';

/** Expo가 한 번에 받는 개수. 넘기면 통째로 거절당한다. */
const BATCH_SIZE = 100;

type ExpoTicket =
  | { status: 'ok'; id: string }
  | { status: 'error'; message: string; details?: { error?: string } };

export function createExpoPush(fetchImpl: typeof fetch = fetch): Push {
  return {
    async send(messages) {
      const outcomes: PushOutcome[] = [];

      for (let start = 0; start < messages.length; start += BATCH_SIZE) {
        const batch = messages.slice(start, start + BATCH_SIZE);

        try {
          const response = await fetchImpl(ENDPOINT, {
            method: 'POST',
            headers: { 'content-type': 'application/json', accept: 'application/json' },
            body: JSON.stringify(
              batch.map((message) => ({
                to: message.token,
                title: message.title,
                body: message.body,
                // 파기는 미룰수록 나빠진다. 조용히 쌓이지 않게 소리를 낸다.
                sound: 'default',
                priority: 'high',
              }))
            ),
          });

          if (!response.ok) {
            const reason = `expo ${response.status}`;

            for (const message of batch) {
              outcomes.push({ token: message.token, delivered: false, error: reason });
            }
            continue;
          }

          const payload = (await response.json()) as { data?: ExpoTicket[] };
          const tickets = payload.data ?? [];

          batch.forEach((message, index) => {
            const ticket = tickets[index];

            if (!ticket) {
              // 티켓이 없으면 갔는지 알 수 없다. 갔다고 치지 않는다.
              outcomes.push({ token: message.token, delivered: false, error: 'no_ticket' });
              return;
            }

            outcomes.push(
              ticket.status === 'ok'
                ? { token: message.token, delivered: true }
                : {
                    token: message.token,
                    delivered: false,
                    // details.error가 죽은 토큰인지를 가른다. 없으면 메시지를 남긴다.
                    error: ticket.details?.error ?? ticket.message,
                  }
            );
          });
        } catch (error) {
          const reason = error instanceof Error ? error.message : 'unknown';

          for (const message of batch) {
            outcomes.push({ token: message.token, delivered: false, error: reason });
          }
        }
      }

      return outcomes;
    },
  };
}
