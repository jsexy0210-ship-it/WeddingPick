import type { PaymentProofReader, ProofImage, ProofReadOutcome } from './payment-reader';
import { callGemini, inlinePart } from './gemini-call';
import { SYSTEM_PROMPT, assertReadableImage, readingSchema } from './payment-reading-spec';

/**
 * 결제내역을 Gemini로 읽는다.
 *
 * 규칙(스키마·지시문)은 `payment-reading-spec.ts`에서, 부르는 방법은
 * `gemini-call.ts`에서 온다. **이 파일에 남은 것은 「무엇을 보내는가」뿐이다.**
 *
 * 키를 헤더로 보내는 것 · 오류 본문을 안 붙이는 것 · `temperature: 0` · 재시도
 * 한도는 전부 공용에 있다 — 부르는 자리마다 따로 지키면 한 곳이 어긋나고, 그
 * 경로로 새는 줄 모른다.
 */
export function createGeminiPaymentReader(env: NodeJS.ProcessEnv = process.env): PaymentProofReader {
  const apiKey = env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY가 없다. Gemini로 읽으려면 키가 있어야 한다.');
  }

  return {
    async read(images: ProofImage[], model: string): Promise<ProofReadOutcome> {
      for (const image of images) assertReadableImage(image.mimeType);

      const { value, usage } = await callGemini({
        apiKey,
        model,
        systemPrompt: SYSTEM_PROMPT,
        schema: readingSchema,
        parts: [
          ...images.map(inlinePart),
          { text: '이 결제내역을 읽고 스키마대로 채워라.' },
        ],
      });

      return {
        reading: value,
        model,
        usage: {
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          cachedInputTokens: usage.cachedInputTokens,
        },
      };
    },
  };
}
