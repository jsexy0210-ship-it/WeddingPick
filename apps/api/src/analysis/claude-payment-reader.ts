import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { MASKED_IDENTIFIER_KINDS, PAYMENT_METHODS } from '@weddingpick/domain';
import { z } from 'zod';

import type { PaymentProofReader, ProofImage, ProofReadOutcome } from './payment-reader';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;

function toImageBlock(image: ProofImage) {
  if (!(IMAGE_TYPES as readonly string[]).includes(image.mimeType)) {
    throw new Error(`읽을 수 없는 형식이다: ${image.mimeType}`);
  }

  return {
    type: 'image' as const,
    source: {
      type: 'base64' as const,
      media_type: image.mimeType as (typeof IMAGE_TYPES)[number],
      data: image.bytes.toString('base64'),
    },
  };
}

/**
 * 모델이 채울 수 있는 칸.
 *
 * **카드번호를 담을 칸이 없다.** 모델에게 "적지 마라"고 부탁하는 대신 적을 곳을
 * 없앤다 — 부탁은 지켜지지 않을 수 있지만 없는 칸에는 못 쓴다. 구조화 출력이라
 * 스키마 밖의 값은 아예 나오지 못한다.
 */
const readingSchema = z.object({
  merchantName: z
    .string()
    .nullable()
    .describe('영수증에 적힌 가맹점 이름. 읽을 수 없으면 null. 사람 이름은 절대 넣지 마라.'),
  paidAmount: z
    .number()
    .int()
    .nullable()
    .describe('실제로 결제된 금액(원). 누적·잔액·한도·적립 금액은 이것이 아니다.'),
  paidAt: z
    .string()
    .nullable()
    .describe('결제 시각. YYYY-MM-DDTHH:mm:ss 형태. 연도가 적혀 있지 않으면 null.'),
  method: z.enum(PAYMENT_METHODS).nullable().describe('결제 수단.'),
  maskedIdentifiers: z
    .array(z.enum(MASKED_IDENTIFIER_KINDS))
    .describe('이미지에 있었던 식별정보의 종류. 값이 아니라 종류만.'),
  rejection: z
    .string()
    .nullable()
    .describe('결제 기록이 아니거나 취소·환불 안내라면 그 이유. 아니면 null.'),
  confidence: z.number().min(0).max(1).describe('읽은 값이 맞다는 확신. 0~1.'),
});

/**
 * 읽는 규칙을 지시문에 적는다.
 *
 * 규칙 파서(payment-parser.ts)와 **같은 규칙**을 쓴다. 두 경로가 다르게 읽으면
 * 같은 영수증이 어떻게 읽혔느냐에 따라 다른 값이 되고, 그건 사용자가 알 수 없다.
 */
const SYSTEM_PROMPT = `너는 한국의 결제내역(카드 승인 문자, 카드 영수증, 이체 알림)에서 값을 읽는다.

규칙:

1. 적혀 있지 않은 값은 null로 둔다. 짐작해서 채우지 마라.
2. 금액은 **실제로 결제된 금액**이다. 누적·잔액·한도·합계·적립·포인트·할인 옆의
   금액은 결제 금액이 아니다.
3. 연도가 적혀 있지 않으면 paidAt을 null로 둔다. 연도를 추측하지 마라 — 그 추측은
   서버가 규칙으로 한다.
4. 취소·환불·승인취소 안내라면 rejection에 그 사실을 적고 나머지는 null로 둔다.
   취소를 결제로 읽으면 내지 않은 돈이 낸 돈이 된다.
5. **사람 이름을 어느 칸에도 넣지 마라.** 가맹점 이름 자리에 카드 명의자 이름을
   넣는 실수가 가장 흔하다. 이름이 보이면 maskedIdentifiers에 person_name만 넣는다.
6. 카드번호·승인번호·계좌번호의 **값을 적지 마라.** 있었다는 종류만
   maskedIdentifiers에 넣는다.
7. 확신이 없으면 confidence를 낮게 준다. 낮은 확신은 사람이 확인하게 되므로,
   틀린 값을 높은 확신으로 주는 것보다 낫다.`;

export function createClaudePaymentReader(): PaymentProofReader {
  const client = new Anthropic();

  return {
    async read(images: ProofImage[], model: string): Promise<ProofReadOutcome> {
      const response = await client.messages.parse({
        model,
        max_tokens: 4000,
        system: [
          {
            type: 'text',
            text: SYSTEM_PROMPT,
            // 지시문은 매번 그대로다. 캐시가 먹도록 앞에 두고 이미지를 뒤에 붙인다.
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: [
          {
            role: 'user',
            content: [
              ...images.map(toImageBlock),
              { type: 'text', text: '이 결제내역을 읽고 스키마대로 채워라.' },
            ],
          },
        ],
        output_config: { format: zodOutputFormat(readingSchema) },
      });

      if (!response.parsed_output) {
        throw new Error('구조화 출력을 읽지 못했다.');
      }

      return {
        reading: response.parsed_output,
        model: response.model,
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
          cachedInputTokens: response.usage.cache_read_input_tokens ?? 0,
        },
      };
    },
  };
}
