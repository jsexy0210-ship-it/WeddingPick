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

/**
 * Gemini 주소를 직접 적어도 되는 파일 — 부르는 «통로» 둘뿐이다. 다른 파일은 이 통로를 거친다.
 *
 * **2026-09-26에 구멍이 하나 드러났다.** `wedding-feed-image.ts`가 `fetch`로 주소를 직접
 * 불러 `callGemini(`를 세는 위 시험에 안 잡혔다 — 여섯째 호출 파일이었다. 그 호출을
 * `gemini-call.ts`의 `callGeminiImage`로 옮기고 부르는 자리를 `wedding-feed-writer.ts`로
 * 모은 뒤, 주소 자체도 센다.
 */
const GATEWAY_FILES = [
  'apps/api/src/analysis/gemini-call.ts', // callGemini · callGeminiImage
  'apps/api/src/analysis/gemini-files.ts', // 상담 녹음 Files API 업로드
];

function grepFiles(pattern: string): string[] {
  try {
    const out = execFileSync(
      'grep',
      ['-rln', '--include=*.ts', '--exclude-dir=node_modules', pattern, 'apps', 'packages', 'scripts'],
      { cwd: ROOT, encoding: 'utf8' }
    );

    return out
      .split('\n')
      .filter(Boolean)
      .filter((path) => !path.endsWith('.test.ts'))
      .sort();
  } catch {
    /* grep은 아무것도 못 찾으면 1로 끝난다. */
    return [];
  }
}

describe('Gemini 호출 범위 — 이미지·녹음·관리자 피드뿐', () => {
  it('`callGemini`를 부르는 파일이 허용 목록과 정확히 같다', () => {
    expect(grepFiles('callGemini(')).toEqual([...ALLOWED_FILES].sort());
  });

  /*
   * 그림을 만드는 호출은 **관리자 피드 자동생성** 하나에만 있다(2026-09-25 대표 지시
   * 「이미지 생성 가능하도록 한다」 — 웨딩피드 그림). 다른 파일이 그림을 만들기 시작하면
   * 여기서 걸린다.
   */
  it('그림 생성(`callGeminiImage`)은 웨딩피드 작성기 하나만 부른다', () => {
    const callers = grepFiles('callGeminiImage(').filter(
      (path) => path !== 'apps/api/src/analysis/gemini-call.ts'
    );

    expect(callers).toEqual(['apps/api/src/analysis/wedding-feed-writer.ts']);
  });

  it('Gemini 주소를 직접 적은 파일은 통로 둘뿐이다 — `fetch`로 돌아가는 호출이 없다', () => {
    expect(grepFiles('generativelanguage.googleapis.com')).toEqual([...GATEWAY_FILES].sort());
  });
});
