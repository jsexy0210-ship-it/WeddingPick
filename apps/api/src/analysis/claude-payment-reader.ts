import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';

import type { PaymentProofReader, ProofImage, ProofReadOutcome } from './payment-reader';
import {
  CLIENT_LIMITS,
  IMAGE_TYPES,
  SYSTEM_PROMPT,
  assertReadableImage,
  readingSchema,
} from './payment-reading-spec';

function toImageBlock(image: ProofImage) {
  assertReadableImage(image.mimeType);

  return {
    type: 'image' as const,
    source: {
      type: 'base64' as const,
      media_type: image.mimeType as (typeof IMAGE_TYPES)[number],
      data: image.bytes.toString('base64'),
    },
  };
}

export function createClaudePaymentReader(): PaymentProofReader {
  const client = new Anthropic(CLIENT_LIMITS);

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
