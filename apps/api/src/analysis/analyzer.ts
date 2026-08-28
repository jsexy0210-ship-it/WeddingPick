import type { Extraction } from './schema';

export type DocumentPage = {
  mimeType: string;
  bytes: Buffer;
};

export type AnalysisOutcome = {
  extraction: Extraction;
  usage: { inputTokens: number; outputTokens: number };
};

/**
 * 문서를 읽어 구조화한다.
 *
 * 테스트에서는 가짜 구현을 끼운다 — 실제 모델 호출은 돈이 들고 결과가 매번 다르다.
 */
export type Analyzer = {
  analyze(pages: DocumentPage[]): Promise<AnalysisOutcome>;
};
