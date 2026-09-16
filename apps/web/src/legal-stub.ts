/**
 * 시험에서 약관·방침 조회를 대신 답하는 자리.
 *
 * 빌드는 이 둘을 읽지 못하면 멈춘다(`legal-data.ts`) — 빈 약관 페이지가 나가는
 * 것보다 옛 빌드가 계속 서빙되는 편이 낫기 때문이다. 그래서 `build()`를 부르는
 * 시험은 전부 이 답을 필요로 한다.
 *
 * **내용을 여기 적지 않는다.** 진짜 본문은 표에 있고(마이그레이션 0420) 무엇이
 * 적혀 있는가는 `apps/api`의 시험이 본다. 여기 있는 것은 «모양»뿐이다 — 내용을
 * 베껴 두면 그것이 또 하나의 사본이 되고, 표가 바뀌어도 여기만 낡는다.
 */
export const LEGAL_STUB = {
  document: {
    version: 'v0.1',
    publishedAt: '2026-09-16T00:00:00.000Z',
    effectiveOn: '2026-10-01',
    clauses: [
      { title: '제1조 목적', body: '시험용 내용.', bodyTable: null, removalWarning: null },
    ],
  },
};

/** `/v1/legal/...`이면 위 답을, 아니면 `null`을 준다. 부르는 쪽이 나머지를 맡는다. */
export function legalStubResponse(url: string): Response | null {
  if (!url.includes('/v1/legal/')) return null;

  return new Response(JSON.stringify(LEGAL_STUB), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}
