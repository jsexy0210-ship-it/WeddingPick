import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

/**
 * Gemini는 세 가지 자리에서만 부른다.
 *
 * 2026-09-23 대표 지시 — 「제미나이 api는 사진, 이미지 분석 및 정보 추출 / 녹음 파일
 * 정보 추출 / 관리자 피드 자동생성 말고는 절대 사용 금지한다」.
 *
 * **오늘 실제로 하나가 그 밖이었다.** `expo-collector.ts`의
 * `createGeminiExpoDiscoverer`는 Google Search로 웹을 검색해 박람회 후보를 짓는
 * 자리였다 — 이미지도 녹음도 피드 생성도 아니다. 지시가 나온 그 자리에서 지웠다.
 *
 * `no-claude.test.ts`와 같은 이유로 시험을 둔다. 글로 적은 규칙은 다음 세션이
 * "검색에도 정보 추출이 있잖아" 하고 넓혀 되돌릴 수 있다 — 세는 시험은 파일
 * 목록으로 못 박아서 그 넓힘을 막는다.
 */
const ROOT = resolve(__dirname, '../../../..');

/** 이 세 가지 일만 한다 — 사진/이미지 판독, 녹음 판독, 관리자 피드 자동생성. */
const ALLOWED_FILES = [
  'apps/api/src/analysis/gemini-analyzer.ts', // 견적서·계약서 이미지 구조화
  'apps/api/src/analysis/gemini-payment-reader.ts', // 결제 증빙 이미지 OCR
  'apps/api/src/analysis/consultation-reader.ts', // 상담 녹음 1차 판정
  'apps/api/src/analysis/gemini-visit-note-reader.ts', // 상담 녹음에서 방문노트 추출
  'apps/api/src/analysis/wedding-feed-writer.ts', // 관리자 콘솔 트리거로 웨딩피드 자동 작성
];

function callGeminiSites(): string[] {
  try {
    const out = execFileSync(
      'grep',
      ['-rln', '--include=*.ts', 'callGemini(', 'apps', 'packages', 'scripts'],
      { cwd: ROOT, encoding: 'utf8' }
    );

    return out.split('\n').filter(Boolean);
  } catch {
    /* grep은 아무것도 못 찾으면 1로 끝난다. */
    return [];
  }
}

describe('Gemini 호출 범위 — 이미지·녹음·관리자 피드뿐', () => {
  it('`callGemini`를 부르는 파일이 허용 목록과 정확히 같다', () => {
    const found = callGeminiSites()
      .filter((path) => !path.endsWith('.test.ts'))
      .sort();

    expect(found).toEqual([...ALLOWED_FILES].sort());
  });
});
