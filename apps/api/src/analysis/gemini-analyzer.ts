import { callGemini, inlinePart } from './gemini-call';

import type { AnalysisOutcome, Analyzer, DocumentPage } from './analyzer';
import { EXTRACTION_SYSTEM_PROMPT, extractionSchema } from './schema';

/**
 * 견적서 · 계약서를 읽어 구조화한다.
 *
 * **2026-09-15 대표 지시로 클로드를 전면 폐기하고 제미나이로 왔다** — 「클로드 API는
 * 싹다 전면 폐기하고 제미나이로 명시해」 · 「결제 증빙·분석 / 웨딩피드 / 녹음파일
 * 분석 다 제미나이다」.
 *
 * 그 전까지는 `claude-analyzer.ts`였다. 바꾼 이유는 돈이다 — **운영 서버가
 * `ANTHROPIC_API_KEY`로 API를 부르는 것은 Max 구독 밖이라 종량 과금이다.**
 * 「클로드는 구독 안에서 처리된다」는 말은 사람이 쓰는 Claude Code 세션 이야기이고,
 * 서버가 부르는 자리에는 맞지 않았다. 대표님이 먼저 짚으셨다.
 *
 * 읽을 수 있는 형식을 여기서 다시 세지 않는다 — 업로드 단계가 이미 거른다.
 * 제미나이는 PDF도 `inline_data`로 그대로 받는다(`gemini-call.ts` `inlinePart`).
 */
export function createGeminiAnalyzer(options: { apiKey: string; model: string }): Analyzer {
  if (!options.apiKey) {
    throw new Error('GEMINI_API_KEY가 없다. 분석 워커를 띄울 수 없다.');
  }

  return {
    async analyze(pages: DocumentPage[]): Promise<AnalysisOutcome> {
      const { value, usage } = await callGemini({
        apiKey: options.apiKey,
        model: options.model,
        systemPrompt: EXTRACTION_SYSTEM_PROMPT,
        schema: extractionSchema,
        parts: [...pages.map(inlinePart), { text: '이 문서를 읽고 스키마대로 채워라.' }],
      });

      return {
        extraction: value,
        usage: { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens },
      };
    },
  };
}
