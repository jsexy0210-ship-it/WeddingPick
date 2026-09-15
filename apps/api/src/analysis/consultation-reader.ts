import {
  type ConsultationCategory,
  type ConsultationDecision,
  decideConsultation,
} from '@weddingpick/domain';

import { type AudioClip, clipForClassification, type ClipPlan } from './audio-clip';
import { callGemini, filePart, inlinePart } from './gemini-call';
import {
  deleteGeminiFile,
  needsFilesApi,
  uploadGeminiFile,
  waitUntilActive,
} from './gemini-files';
import {
  CLASSIFY_PROMPT,
  type Classification,
  EXTRACT_PROMPT,
  classificationSchema,
  type ConsultationReading,
  readingSchemaFor,
} from './consultation-spec';

/**
 * 상담 녹음 하나를 읽는 전체 흐름.
 *
 *   조각내기 → 1차 판정 → 부를지 정하기 → (멈춤 · 물음) 또는 2차 추출
 *
 * **1차에서 멈추는 것이 이 설계의 값어치다.** 한 시간짜리 녹음의 2차는 48원이고,
 * 앞 3분 + 뒤 2분만 보내는 1차는 0.4원이다. 웨딩 상담이 아닌 파일에 48원을 쓰지
 * 않는다.
 *
 * 돈까지 쓰면서 친구와의 치킨 주문 대화를 뜯어볼 이유가 없다.
 */

export type ConsultationUsage = {
  inputTokens: number;
  outputTokens: number;
  audioTokens: number;
};

const ZERO: ConsultationUsage = { inputTokens: 0, outputTokens: 0, audioTokens: 0 };

function add(a: ConsultationUsage, b: ConsultationUsage): ConsultationUsage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    audioTokens: a.audioTokens + b.audioTokens,
  };
}

/**
 * 읽기가 어떻게 끝났나.
 *
 * **`usage`는 어느 경우에도 돌려준다.** 멈춘 호출도 돈을 썼다 — 안 돌려주면
 * 막힌 파일의 비용이 합계에서 사라지고, 예산이 실제보다 넉넉해 보인다.
 */
export type ConsultationOutcome =
  | {
      kind: 'read';
      category: ConsultationCategory;
      classification: Classification;
      reading: ConsultationReading;
      model: string;
      usage: ConsultationUsage;
    }
  | {
      kind: 'stopped';
      decision: Exclude<ConsultationDecision, { kind: 'analyze' }>;
      classification: Classification;
      model: string;
      usage: ConsultationUsage;
    };

export type ConsultationReader = {
  /** 1차 — 무엇인지만 가른다. 값은 뽑지 않는다. */
  classify(clips: AudioClip[], model: string): Promise<{
    classification: Classification;
    usage: ConsultationUsage;
  }>;
  /** 2차 — 그 업종의 칸을 채운다. */
  extract(
    audio: AudioClip,
    category: ConsultationCategory,
    model: string
  ): Promise<{ reading: ConsultationReading; usage: ConsultationUsage }>;
};

export function createGeminiConsultationReader(
  env: NodeJS.ProcessEnv = process.env,
  /**
   * 올린 녹음을 못 지웠을 때 부른다. **삼키지 않는다** — 「지웠다」가 사실이 아닌
   * 채로 기록되면 그 뒤에 아무도 확인하지 않는다. 재시도 큐가 이 자리에 붙는다.
   */
  onDeleteFailed?: (name: string) => void
): ConsultationReader {
  const apiKey = env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY가 없다. Gemini로 읽으려면 키가 있어야 한다.');
  }

  return {
    async classify(clips, model) {
      const { value, usage } = await callGemini({
        apiKey,
        model,
        systemPrompt: CLASSIFY_PROMPT,
        schema: classificationSchema,
        parts: [
          ...clips.map(inlinePart),
          {
            text:
              clips.length > 1
                ? '이 녹음의 앞부분과 뒷부분이다. 웨딩업체 상담인지 가르고 스키마대로 채워라.'
                : '이 녹음이 웨딩업체 상담인지 가르고 스키마대로 채워라.',
          },
        ],
      });

      return { classification: value, usage };
    },

    async extract(audio, category, model) {
      /*
       * 2차는 **전체**를 보낸다. 요청 본문에 실을 수 있는 크기를 넘으면 올린 뒤
       * 참조를 넘긴다 — 대표님이 정한 상한 100MB는 본문으로 못 들어간다.
       */
      const uploaded = needsFilesApi(audio.bytes.length)
        ? await uploadGeminiFile({
            apiKey,
            bytes: audio.bytes,
            mimeType: audio.mimeType,
            // 파일 이름에 사용자·업체를 적지 않는다. 저쪽 목록에 남는 값이다.
            displayName: '상담 녹음',
          })
        : null;

      try {
        if (uploaded) {
          /*
           * 올린 직후는 아직 못 읽는 상태다. 그대로 부르면 거절당하는데 —
           * **거절당한 호출도 과금된다.** 음성은 비싸서 그 한 번이 아깝다.
           */
          await waitUntilActive({ apiKey, name: uploaded.name });
        }

        const { value, usage } = await callGemini({
          apiKey,
          model,
          systemPrompt: EXTRACT_PROMPT,
          schema: readingSchemaFor(category),
          parts: [
            uploaded
              ? filePart({ mimeType: audio.mimeType, fileUri: uploaded.uri })
              : inlinePart(audio),
            { text: '이 상담 녹음에서 정해진 칸을 채워라.' },
          ],
        });

        return { reading: value, usage };
      } finally {
        /*
         * **읽었든 실패했든 지운다.** 저쪽은 48시간 뒤에 지우지만 그것을 기다리지
         * 않는다 — 처리방침에 「읽어내기가 끝나는 즉시 삭제」라고 적었고, 우리
         * 저장소만 비우고 남의 저장소에 이틀 두는 것은 그 약속과 다르다.
         *
         * 실패는 조용히 넘기지 않고 부르는 쪽이 알 수 있게 남긴다.
         */
        if (uploaded) {
          const gone = await deleteGeminiFile({ apiKey, name: uploaded.name });

          if (!gone) onDeleteFailed?.(uploaded.name);
        }
      }
    },
  };
}

/**
 * 1차 → 판정 → 2차.
 *
 * **2차는 `analyze`일 때만 부른다.** 그 한 줄이 이 기능의 비용을 정한다.
 */
export async function readConsultation(input: {
  reader: ConsultationReader;
  bytes: Buffer;
  mimeType: string;
  extension: string;
  model: string;
  /** 사용자가 업종을 골랐으면 그것을 쓴다. 안 골랐으면 1차가 정한다. */
  category?: ConsultationCategory;
}): Promise<ConsultationOutcome & { plan: ClipPlan }> {
  const { parts, plan } = await clipForClassification(input);
  const first = await input.reader.classify(parts, input.model);
  const decision = decideConsultation({
    status: first.classification.status,
    confidence: first.classification.confidence,
    signals: first.classification.consultationSignals,
  });

  if (decision.kind !== 'analyze') {
    return {
      kind: 'stopped',
      decision,
      classification: first.classification,
      model: input.model,
      usage: add(ZERO, first.usage),
      plan,
    };
  }

  /*
   * 업종을 고르지 못했으면 2차를 부르지 않는다. **어느 칸을 채울지 모르는 채로
   * 전체를 보내면 값만 나가고 담을 곳이 없다.** 사람에게 묻는 자리로 보낸다.
   */
  const category = input.category ?? first.classification.category;

  if (!category) {
    return {
      kind: 'stopped',
      decision: { kind: 'ask', notice: '어느 업종 상담인지 확인이 필요해요.' },
      classification: first.classification,
      model: input.model,
      usage: add(ZERO, first.usage),
      plan,
    };
  }

  const second = await input.reader.extract(
    // 2차는 **전체**를 보낸다. 조각으로 뽑으면 중간에 말한 금액이 빠진다.
    { mimeType: input.mimeType, bytes: input.bytes, seconds: plan.seconds },
    category,
    input.model
  );

  return {
    kind: 'read',
    category,
    classification: first.classification,
    reading: second.reading,
    model: input.model,
    usage: add(first.usage, second.usage),
    plan,
  };
}
