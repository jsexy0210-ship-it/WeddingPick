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

      /*
       * 운영이 아니면 보내지 않는다.
       *
       * **막는 장치가 없었다**(Release Audit 1차 P1-6). 스테이징 DB에 실사용자
       * 기기 토큰이 남아 있으면 시험 발송이 그 사람 폰으로 그대로 나간다.
       * 토큰은 어느 DB에서 왔는지 스스로 말해주지 않으므로 여기서 막는다.
       *
       * 보낸 척하지 않는다 — 무엇을 보내려 했는지 로그에 남기고, 결과는
       * 「닿지 않음」으로 돌려준다. 성공으로 돌려주면 발송 통계가 거짓이 된다.
       */
      if (process.env.NODE_ENV !== 'production') {
        console.log(`푸시 ${messages.length}건 — NODE_ENV가 production이 아니라 보내지 않는다.`);

        return messages.map((message) => ({
          token: message.token,
          delivered: false,
          error: 'not_production',
        }));
      }

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
