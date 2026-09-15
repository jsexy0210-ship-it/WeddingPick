import { checkVisitNoteAudio } from '@weddingpick/domain';

import { callGemini, inlinePart } from './gemini-call';
import {
  VISIT_NOTE_PROMPT,
  type VisitNoteAudio,
  type VisitNoteReadOutcome,
  type VisitNoteReader,
  visitNoteReadingSchema,
} from './visit-note-reader';

/**
 * 상담 녹음에서 방문노트 네 칸을 읽는다.
 *
 * **전처리를 하지 않는다.** Gemini는 음성을 초당 32토큰으로 세고 받기 전에
 * 16kbps 모노로 스스로 낮춘다 — 압축해 보내도 토큰은 한 개도 안 줄어든다.
 *
 * 줄일 수 있는 것은 **헛호출**뿐이다. 형식과 길이는 보내기 전에 알 수 있고,
 * 거절당한 호출도 과금되므로 `checkVisitNoteAudio()`로 먼저 막는다.
 */
export function createGeminiVisitNoteReader(env: NodeJS.ProcessEnv = process.env): VisitNoteReader {
  const apiKey = env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY가 없다. Gemini로 읽으려면 키가 있어야 한다.');
  }

  return {
    async read(audio: VisitNoteAudio, model: string): Promise<VisitNoteReadOutcome> {
      // **부르기 전에 막는다.** 거절당한 호출도 과금된다.
      const rejection = checkVisitNoteAudio({ mimeType: audio.mimeType, seconds: audio.seconds });

      if (rejection) {
        throw new Error(`읽을 수 없는 녹음이다: ${rejection.kind}`);
      }

      const { value, usage } = await callGemini({
        apiKey,
        model,
        systemPrompt: VISIT_NOTE_PROMPT,
        schema: visitNoteReadingSchema,
        parts: [inlinePart(audio), { text: '이 상담 녹음에서 방문노트 네 칸을 뽑아 스키마대로 채워라.' }],
      });

      return {
        reading: value,
        model,
        usage: {
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          audioTokens: usage.audioTokens,
        },
      };
    },
  };
}
