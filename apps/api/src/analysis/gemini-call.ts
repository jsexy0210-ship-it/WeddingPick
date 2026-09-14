import { z } from 'zod';

import { CLIENT_LIMITS } from './payment-reading-spec';

/**
 * Gemini를 부르는 **한 자리**.
 *
 * 부르는 곳이 셋이 됐다 — 결제내역 읽기 · 상담 1차 판정 · 상담 2차 추출. 셋이
 * 각자 `fetch`를 쓰면 **키를 헤더로 보내는 것도, 오류 본문을 안 붙이는 것도 셋
 * 다에서 따로 지켜야 한다.** 한 곳만 어긋나면 그 경로로 새는데, 새는 줄 모른다.
 *
 * 여기서 지키는 것:
 *
 * - 키를 **주소가 아니라 헤더**로 보낸다. 주소는 프록시 로그·오류 보고에 남는다
 * - **오류 본문을 메시지에 붙이지 않는다.** 오류 응답에 요청이 되비쳐 담기는
 *   서비스가 있고, 그대로 붙이면 영수증 이미지와 상담 녹음이 로그로 나간다
 * - `temperature: 0` — 읽어내는 일이라 같은 입력은 같게 읽혀야 한다
 * - 타임아웃과 재시도 한도를 공용에서 읽는다
 *
 * **SDK를 넣지 않았다.** 요청 한 가지이고 `fetch`는 Node 18부터 표준이다.
 */

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * 봉투에서 우리가 보는 자리만 적는다. **전부 선택 항목이다** — 응답이 기대와
 * 다를 때 `undefined`를 만나 워커가 죽는 것보다, 스키마가 막아 「읽지 못했다」로
 * 끝나 사람이 확인하는 자리로 가는 편이 낫다.
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
      promptTokensDetails: z
        .array(z.object({ modality: z.string().optional(), tokenCount: z.number().optional() }))
        .optional(),
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
 * `$schema`와 `additionalProperties`는 떼어낸다 — `responseSchema`가 받지 않는다.
 */
export function toGeminiSchema(schema: z.ZodType): unknown {
  const json = z.toJSONSchema(schema, { io: 'output' }) as Record<string, unknown>;

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

export type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

export type GeminiUsage = {
  inputTokens: number;
  outputTokens: number;
  audioTokens: number;
  cachedInputTokens: number;
};

/**
 * 음성 토큰만 골라 센다.
 *
 * `promptTokenCount`는 글자와 음성을 합친 값이라 그대로 넘기면 비싼 음성이 싼 글자
 * 단가로 계산된다 — 상담기록 비용이 실제의 3분의 1로 잡힌다.
 *
 * 내역을 안 주면 0으로 둔다. **모르는 값을 빼서 적게 잡지 않는다.**
 */
function audioTokensFrom(details: { modality?: string; tokenCount?: number }[] | undefined): number {
  if (!details) return 0;

  return details
    .filter((detail) => detail.modality?.toUpperCase() === 'AUDIO')
    .reduce((sum, detail) => sum + (detail.tokenCount ?? 0), 0);
}

/** 한 번 호출한다. 재시도는 `callGemini`가 센다. */
async function once(input: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  parts: GeminiPart[];
  schema: z.ZodType;
  signal: AbortSignal;
}): Promise<unknown> {
  const response = await fetch(`${ENDPOINT}/${encodeURIComponent(input.model)}:generateContent`, {
    method: 'POST',
    signal: input.signal,
    headers: {
      'content-type': 'application/json',
      // 키를 쿼리스트링이 아니라 헤더로 보낸다 — 주소는 프록시·로그에 남는다.
      'x-goog-api-key': input.apiKey,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: input.systemPrompt }] },
      contents: [{ role: 'user', parts: input.parts }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: toGeminiSchema(input.schema),
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
     * 그러면 영수증 이미지와 상담 녹음이 로그로 나간다. 상태코드와 메시지만 남긴다.
     */
    throw new Error(`Gemini가 ${response.status}로 거절했다. ${detail}`.trim());
  }

  return body;
}

/**
 * 부르고 결과를 스키마로 받는다. 실패하면 한도까지 다시 부른다.
 *
 * **스키마 밖의 값은 돌아오지 못한다** — 구조화 출력이고, 받은 뒤에도 zod가 한 번
 * 더 본다. 담을 칸이 없으면 못 쓴다는 규칙이 여기서 실제로 지켜진다.
 */
export async function callGemini<T extends z.ZodType>(input: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  parts: GeminiPart[];
  schema: T;
}): Promise<{ value: z.infer<T>; usage: GeminiUsage }> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= CLIENT_LIMITS.maxRetries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CLIENT_LIMITS.timeout);

    try {
      const body = await once({ ...input, signal: controller.signal });
      const envelope = responseEnvelope.parse(body);
      const text = envelope.candidates?.[0]?.content?.parts?.find((part) => part.text)?.text;

      if (text === undefined) {
        const reason = envelope.candidates?.[0]?.finishReason ?? '알 수 없음';

        throw new Error(`구조화 출력을 읽지 못했다. finishReason=${reason}`);
      }

      const usage = envelope.usageMetadata;
      const audioTokens = audioTokensFrom(usage?.promptTokensDetails);

      return {
        value: input.schema.parse(JSON.parse(text)) as z.infer<T>,
        usage: {
          // 합계에서 음성을 뺀 것이 글자다. 빼지 않으면 같은 토큰을 두 번 센다.
          inputTokens: Math.max(0, (usage?.promptTokenCount ?? 0) - audioTokens),
          outputTokens: usage?.candidatesTokenCount ?? 0,
          audioTokens,
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
}

/** 음성·이미지 한 조각을 요청에 담는 꼴로. */
export function inlinePart(input: { mimeType: string; bytes: Buffer }): GeminiPart {
  return { inlineData: { mimeType: input.mimeType, data: input.bytes.toString('base64') } };
}
