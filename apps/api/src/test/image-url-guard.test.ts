import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..', '..', '..');

/**
 * 업체 사진 주소를 내보내는 질의는 **하나도 빠짐없이** 핫링킹 차단 호스트를 걸러야 한다.
 *
 * 왜 이 시험이 있는가 — 2026-09-15에 실제로 한 자리가 샜다. 홈 전면 개편이
 * `loadVendorSummaries`를 새로 만들면서 `source_url IS NOT NULL`만 걸었고, 그것은
 * 기존 질의를 베껴 온 모양이라 리뷰에서도 자연스러워 보였다. 텍스트 충돌도 나지
 * 않아 머지도 조용히 지나갔다. **막힌 주소가 홈 화면으로 다시 나갈 뻔했다.**
 *
 * 자리를 목록으로 적어 두면 여덟 번째 질의를 쓰는 사람이 적는 것을 잊는다. 잊은 것은
 * 고장으로 보이지 않는다 — 화면은 그대로 그려지고 콘솔에만 403이 쌓인다. 그래서
 * **저장소를 실제로 훑는다**(`admin-write-guard.test.ts`와 같은 방식).
 *
 * 관리자 화면은 뺀다. 검수자가 원본을 봐야 하는 감사 자리라 일부러 거르지 않는다.
 */
function imageQueryLines(): { path: string; line: number; text: string }[] {
  const files = execFileSync('git', ['ls-files', 'apps/api/src/routes/*.ts'], {
    cwd: ROOT,
    encoding: 'utf8',
  })
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((path) => !path.endsWith('admin.ts'));

  const found: { path: string; line: number; text: string }[] = [];

  for (const path of files) {
    const lines = readFileSync(join(ROOT, path), 'utf8').split('\n');

    lines.forEach((text, index) => {
      /*
       * 「사진 표에서 주소 칸을 고른다」가 내보내는 질의의 모양이다. 표를 세거나
       * 지우는 질의는 주소를 고르지 않으므로 여기 걸리지 않는다.
       */
      if (/source_url\s+FROM\s+structured\.vendor_images/i.test(text)) {
        found.push({ path, line: index + 1, text });
      }
    });
  }

  return found;
}

describe('업체 사진 주소를 내보내는 질의', () => {
  it('저장소에서 실제로 찾아낸다 — 못 찾으면 이 시험은 아무것도 지키지 않는다', () => {
    // 훑는 규칙이 깨져 0건이 되면 시험은 조용히 통과한다. 그 상태를 먼저 막는다.
    expect(imageQueryLines().length).toBeGreaterThanOrEqual(5);
  });

  it('하나도 빠짐없이 핫링킹 차단 호스트를 거른다', () => {
    /*
     * 질의 하나는 여러 줄에 걸쳐 있으므로 고르는 줄 뒤 네 줄까지를 함께 본다.
     * 조건이 그 안에 없으면 그 질의는 거르지 않는 것이다.
     */
    const leaking = imageQueryLines().filter(({ path, line }) => {
      const lines = readFileSync(join(ROOT, path), 'utf8').split('\n');
      const window = lines.slice(line - 1, line + 4).join('\n');

      return !window.includes('displayableImageUrlCondition');
    });

    expect(
      leaking.map(({ path, line }) => `${path}:${line}`)
    ).toEqual([]);
  });
});
