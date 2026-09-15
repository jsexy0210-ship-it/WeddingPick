import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

/**
 * 클로드 API가 저장소에 한 줄도 없는지 본다.
 *
 * 2026-09-15 대표 지시 — 「클로드 API는 싹다 전면 폐기하고 제미나이로 명시해」 ·
 * 「결제 증빙·분석 / 웨딩피드 / 녹음파일 분석 다 제미나이다」.
 *
 * **이유는 돈이다.** 운영 서버가 `ANTHROPIC_API_KEY`로 API를 부르는 것은 Max
 * 구독 밖이라 종량 과금이다. 「클로드는 구독 안에서 처리된다」는 말은 사람이 쓰는
 * Claude Code 세션 이야기이고, 서버가 부르는 자리에는 맞지 않았다.
 *
 * **글로 적은 규칙은 깨진다.** 오늘 하루에 이 자리가 두 번 뒤집혔고, 그때마다
 * 부르는 코드 · 시험 · 배포 선언이 따로 놀았다. 그래서 세는 시험을 둔다 —
 * 되돌아가는 변경은 리뷰가 아니라 여기서 걸린다.
 *
 * 실제 호출을 흉내로 막던 자리(`wedding-feed-writer.test.ts`의 `jest.mock`)보다
 * 이쪽이 강하다. 저쪽은 그 파일 하나만 보고, 이쪽은 전부 본다.
 */
const ROOT = resolve(__dirname, '../../../..');

/**
 * 저장소에서 패턴을 찾아 「파일:줄」로 돌려준다.
 *
 * **주석은 세지 않는다.** 왜 폐기했는지를 적어 둔 문단이 여러 파일에 있고, 그것까지
 * 잡으면 기록을 남길 수 없게 된다 — 규칙을 지키려고 규칙의 근거를 지우는 꼴이다.
 * 잡을 것은 **실제로 부르는 줄**이다.
 */
function callSites(pattern: string): string[] {
  try {
    const out = execFileSync(
      'grep',
      [
        '-rn',
        '--include=*.ts',
        '--include=*.tsx',
        '--include=*.json',
        '--include=*.yml',
        pattern,
        'apps',
        'packages',
        'scripts',
        'infra',
      ],
      { cwd: ROOT, encoding: 'utf8' }
    );

    return out
      .split('\n')
      .filter(Boolean)
      .filter((line) => !line.includes('no-claude.test.ts'))
      .filter((line) => {
        /* `path:line:내용`에서 내용만 떼어 본다. */
        const body = line.split(':').slice(2).join(':').trim();

        return !(body.startsWith('*') || body.startsWith('//') || body.startsWith('/*'));
      });
  } catch {
    /* grep은 아무것도 못 찾으면 1로 끝난다. 그것이 우리가 바라는 결과다. */
    return [];
  }
}

describe('클로드 API 전면 폐기', () => {
  it('`@anthropic-ai/sdk`를 부르는 곳이 없다', () => {
    expect(callSites('@anthropic-ai/sdk')).toEqual([]);
  });

  it('`ANTHROPIC_API_KEY`를 읽거나 배포로 흘리는 곳이 없다', () => {
    expect(callSites('ANTHROPIC_API_KEY')).toEqual([]);
  });
});
