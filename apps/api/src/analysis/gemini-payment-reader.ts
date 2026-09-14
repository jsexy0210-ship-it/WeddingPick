import { z } from 'zod';

import type { PaymentProofReader, ProofImage, ProofReadOutcome } from './payment-reader';
import {
  CLIENT_LIMITS,
  SYSTEM_PROMPT,
  assertReadableImage,
  readingSchema,
} from './payment-reading-spec';

/**
 * 결제내역을 Gemini로 읽는다.
 *
 * 규칙(스키마·지시문)은 `payment-reading-spec.ts` 하나에서 온다 — Claude 쪽과 같은
 * 것을 본다. 여기 있는 것은 **부르는 방법**뿐이다.
 *
 * ## SDK를 넣지 않은 이유
 *
 * 부르는 자리가 이 파일 하나이고 요청 한 번이다. 의존성을 하나 늘리면 그 패키지의
 * 갱신·취약점·전이 의존까지 따라오는데, 그 값에 비해 여기서 얻는 것이 적다.
 * `fetch`는 Node 18부터 표준이다.
 *
 * ## 키는 서버에만 있다
 *
 * `GEMINI_API_KEY`는 API 서버 프로세스의 환경변수다. 앱 번들에 들어가지 않는다 —
 * `EXPO_PUBLIC_` 접두사를 붙이는 순간 번들에 박히고, 그것을 막는 시험이
 * `test/gemini-key-server-only.test.ts`에 있다.
 */

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Gemini가 돌려주는 봉투에서 우리가 보는 자리만 적는다.
 *
 * **전부 선택 항목으로 둔다.** 응답이 기대와 다를 때 `undefined`를 만나 터지는 것과,
 * 스키마가 막아 「읽지 못했다」로 끝나는 것은 다르다. 뒤쪽은 사람이 확인하는 자리로
 * 넘어가고 앞쪽은 워커가 죽는다.
 */
const responseEnvelope = z.object({
  candidates: z
    .array(
      z.object({
        content: z.object({ parts: z.array(z.object({ text: z.string().optional() })) }).optional(),
        finishReason: z.string().optional(),
      })
    )
    .optional(),
  usageMetadata: z
    .object({
      promptTokenCount: z.number().optional(),
      candidatesTokenCount: z.number().optional(),
      cachedContentTokenCount: z.number().optional(),
    })
    .optional(),
  error: z.object({ message: z.string() }).optional(),
});

/**
 * zod 스키마를 Gemini가 읽는 꼴로 바꾼다.
 *
 * **손으로 다시 적지 않는다.** 두 벌을 두면 칸 하나를 더할 때 한쪽만 고쳐지고,
 * 그 순간 모델이 채울 수 있는 칸과 우리가 받는 칸이 어긋난다.
 *
 * `$schema`와 `additionalProperties`는 떼어낸다 — Gemini의 `responseSchema`가
 * 받지 않는 키다.
 */
function toGeminiSchema(): unknown {
  const json = z.toJSONSchema(readingSchema, { io: 'output' }) as Record<string, unknown>;

  const strip = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(strip);
    if (node === null || typeof node !== 'object') return node;

    const out: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (key === '$schema' || key === 'additionalProperties') continue;
      out[key] = strip(value);
    }

    return out;
  };

  return strip(json);
}

/** 한 번 호출한다. 재시도는 부르는 쪽이 센다. */
async function callOnce(
  apiKey: string,
  model: string,
  images: ProofImage[],
  signal: AbortSignal
): Promise<unknown> {
  const response = await fetch(`${ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    signal,
    headers: {
      'content-type': 'application/json',
      // 키를 쿼리스트링이 아니라 헤더로 보낸다 — 주소는 프록시·로그에 남는다.
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [
        {
          role: 'user',
          parts: [
            ...images.map((image) => ({
              inlineData: { mimeType: image.mimeType, data: image.bytes.toString('base64') },
            })),
            { text: '이 결제내역을 읽고 스키마대로 채워라.' },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: toGeminiSchema(),
        // 읽어내는 일이다. 같은 영수증은 같게 읽혀야 한다.
        temperature: 0,
      },
    }),
  });

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const parsed = responseEnvelope.safeParse(body);
    const detail = parsed.success ? (parsed.data.error?.message ?? '') : '';

    /*
     * 본문을 그대로 붙이지 않는다. 오류 응답에 요청이 되비쳐 담기는 서비스가 있고,
     * 그러면 영수증 이미지가 로그로 나간다. 상태코드와 메시지만 남긴다.
     */
    throw new Error(`Gemini가 ${response.status}로 거절했다. ${detail}`.trim());
  }

  return body;
}

export function createGeminiPaymentReader(env: NodeJS.ProcessEnv = process.env): PaymentProofReader {
  const apiKey = env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY가 없다. Gemini로 읽으려면 키가 있어야 한다.');
  }

  return {
    async read(images: ProofImage[], model: string): Promise<ProofReadOutcome> {
      for (const image of images) assertReadableImage(image.mimeType);

      let lastError: unknown;

      for (let attempt = 0; attempt <= CLIENT_LIMITS.maxRetries; attempt += 1) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), CLIENT_LIMITS.timeout);

        try {
          const body = await callOnce(apiKey, model, images, controller.signal);
          const envelope = responseEnvelope.parse(body);
          const text = envelope.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text;

          if (text === undefined) {
            const reason = envelope.candidates?.[0]?.finishReason ?? '알 수 없음';

            throw new Error(`구조화 출력을 읽지 못했다. finishReason=${reason}`);
          }

          const reading = readingSchema.parse(JSON.parse(text));
          const usage = envelope.usageMetadata;

          return {
            reading,
            model,
            usage: {
              inputTokens: usage?.promptTokenCount ?? 0,
              outputTokens: usage?.candidatesTokenCount ?? 0,
              cachedInputTokens: usage?.cachedContentTokenCount ?? 0,
            },
          };
        } catch (error) {
          lastError = error;
        } finally {
          clearTimeout(timer);
        }
      }

      throw lastError instanceof Error ? lastError : new Error('Gemini 호출이 실패했다.');
    },
  };
}
