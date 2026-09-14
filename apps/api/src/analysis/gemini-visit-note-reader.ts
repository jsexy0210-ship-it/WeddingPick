import { checkVisitNoteAudio } from '@weddingpick/domain';
import { z } from 'zod';

import { CLIENT_LIMITS } from './payment-reading-spec';
import {
  VISIT_NOTE_PROMPT,
  type VisitNoteAudio,
  type VisitNoteReadOutcome,
  type VisitNoteReader,
  visitNoteReadingSchema,
} from './visit-note-reader';

/**
 * 상담 녹음을 Gemini로 읽는다.
 *
 * 규칙(스키마·지시문)은 `visit-note-reader.ts` 하나에서 온다. 여기 있는 것은
 * **부르는 방법**뿐이다 — 결제내역 쪽(`gemini-payment-reader.ts`)과 같은 모양이다.
 *
 * ## 전처리를 하지 않는다
 *
 * Gemini는 음성을 **초당 32토큰**으로 세고, 받기 전에 16kbps 모노로 스스로
 * 다운샘플한다. 그래서 우리가 압축해서 보내도 토큰은 한 개도 줄지 않는다 —
 * 전처리는 돈을 아끼지 못하고 서버 시간과 임시 파일만 늘린다.
 *
 * 줄일 수 있는 것은 **헛호출**뿐이다. 형식과 길이는 보내기 전에 알 수 있고,
 * 거절당한 호출도 과금되므로 `checkVisitNoteAudio()`로 먼저 막는다.
 */

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * 봉투에서 우리가 보는 자리만 적는다. 전부 선택 항목이다 — 응답이 기대와 다를 때
 * 워커가 죽는 것보다 「읽지 못했다」로 끝나 사람에게 넘어가는 편이 낫다.
 *
 * `promptTokensDetails`가 **음성 토큰을 따로 알려주는 유일한 자리**다.
 * `promptTokenCount`는 글자와 음성을 합친 값이라, 그것만 보면 비싼 음성이 싼 글자
 * 단가로 계산된다.
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
      promptTokensDetails: z
        .array(z.object({ modality: z.string().optional(), tokenCount: z.number().optional() }))
        .optional(),
    })
    .optional(),
  error: z.object({ message: z.string() }).optional(),
});

/**
 * zod 스키마를 Gemini가 읽는 꼴로 바꾼다. 손으로 다시 적지 않는다 — 두 벌을 두면
 * 칸 하나를 더할 때 한쪽만 고쳐진다.
 */
function toGeminiSchema(): unknown {
  const json = z.toJSONSchema(visitNoteReadingSchema, { io: 'output' }) as Record<string, unknown>;

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
  audio: VisitNoteAudio,
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
      systemInstruction: { parts: [{ text: VISIT_NOTE_PROMPT }] },
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType: audio.mimeType, data: audio.bytes.toString('base64') } },
            { text: '이 상담 녹음에서 방문노트 네 칸을 뽑아 스키마대로 채워라.' },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: toGeminiSchema(),
        // 뽑아내는 일이다. 같은 녹음은 같게 읽혀야 한다.
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
     * 그러면 상담 녹음이 로그로 나간다. 상태코드와 메시지만 남긴다.
     */
    throw new Error(`Gemini가 ${response.status}로 거절했다. ${detail}`.trim());
  }

  return body;
}

/** 음성 토큰만 골라 센다. 없으면 0이다 — 글자로 세어 싸게 잡지 않는다. */
function audioTokensFromUsage(
  details: { modality?: string; tokenCount?: number }[] | undefined
): number {
  if (!details) return 0;

  return details
    .filter((d) => d.modality?.toUpperCase() === 'AUDIO')
    .reduce((sum, d) => sum + (d.tokenCount ?? 0), 0);
}

export function createGeminiVisitNoteReader(
  env: NodeJS.ProcessEnv = process.env
): VisitNoteReader {
  const apiKey = env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY가 없다. Gemini로 읽으려면 키가 있어야 한다.');
  }

  return {
    async read(audio: VisitNoteAudio, model: string): Promise<VisitNoteReadOutcome> {
      /*
       * **부르기 전에 막는다.** 거절당한 호출도 과금된다. 형식과 길이는 보내기 전에
       * 알 수 있으므로 여기서 끝낸다.
       */
      const rejection = checkVisitNoteAudio({
        mimeType: audio.mimeType,
        seconds: audio.seconds,
      });

      if (rejection) {
        throw new Error(`읽을 수 없는 녹음이다: ${rejection.kind}`);
      }

      let lastError: unknown;

      for (let attempt = 0; attempt <= CLIENT_LIMITS.maxRetries; attempt += 1) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), CLIENT_LIMITS.timeout);

        try {
          const body = await callOnce(apiKey, model, audio, controller.signal);
          const envelope = responseEnvelope.parse(body);
          const text = envelope.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text;

          if (text === undefined) {
            const reason = envelope.candidates?.[0]?.finishReason ?? '알 수 없음';

            throw new Error(`구조화 출력을 읽지 못했다. finishReason=${reason}`);
          }

          const reading = visitNoteReadingSchema.parse(JSON.parse(text));
          const usage = envelope.usageMetadata;
          const audioTokens = audioTokensFromUsage(usage?.promptTokensDetails);

          return {
            reading,
            model,
            usage: {
              /*
               * 합계에서 음성을 뺀 것이 글자다. 빼지 않으면 같은 토큰을 두 번 세게
               * 되고, 음성 단가가 비싸서 비용이 실제보다 크게 잡힌다.
               */
              inputTokens: Math.max(0, (usage?.promptTokenCount ?? 0) - audioTokens),
              outputTokens: usage?.candidatesTokenCount ?? 0,
              audioTokens,
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
