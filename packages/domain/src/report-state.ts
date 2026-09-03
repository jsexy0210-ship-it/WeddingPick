/**
 * 제보·신청의 상태와 사용자 문구를 가른다.
 *
 * 지금까지 흐름마다 자기 말을 썼다 — 같은 "끝났다"를 `승인` · `확인 완료` ·
 * `답변 완료`라고 적고, 같은 "안 됐다"를 `반려` · `확인하지 못함` ·
 * `게시하지 않음`이라고 적었다. 사용자는 그 셋이 같은 일인지 다른 일인지 알 수 없다.
 *
 * 여기서 정하는 것은 **상태 이름 하나와 그 상태의 사용자 문구 하나**다. 내부
 * 코드(`in_review`, `pending`)는 흐름마다 다르게 남아 있어도 되고, 화면으로
 * 나가는 말은 이 표를 지난다.
 *
 * 흐름이 더 말할 것이 있으면 문구를 덧붙이지 말고 **다른 상태를 쓴다.** 예를 들어
 * 반론이 실제로 게시된 것은 `verified`가 아니라 그 흐름만의 결과라, 아래 예외
 * 목록에 이유와 함께 적어둔다.
 */
export const REPORT_STATES = [
  /** 기계가 읽는 중. */
  'analyzing',
  /** 값을 맞춰보는 중. */
  'verifying',
  /** 사람이 한 번 봐줘야 넘어간다. */
  'need_user_confirm',
  /** 우리 쪽에서 보는 중. */
  'under_review',
  /** 낸 사람이 자료를 보완해야 다음으로 넘어간다. */
  'needs_supplement',
  /** 확인이 끝났고 쓰이고 있다. */
  'verified',
  /** 확인했지만 반영하지 않았다. */
  'rejected',
  /** 낸 사람이 물렸다. */
  'canceled',
  /** 지웠다. */
  'deleted',
] as const;

export type ReportState = (typeof REPORT_STATES)[number];

/**
 * 화면에 나가는 말. **이 표 밖의 문구를 상태 자리에 적지 않는다.**
 *
 * `분석 중`과 `확인 중`을 가른 이유: 앞은 기계가 읽는 중이고 뒤는 사람이 맞춰보는
 * 중이다. 걸리는 시간이 다르고, 사용자가 기다릴지 다시 볼지도 다르다.
 *
 * `확인 중`이 둘(`verifying`, `under_review`)인 것은 일부러다. 안에서는 다른
 * 일이지만 밖에서 보면 똑같이 기다리는 시간이고, 사용자에게 그 차이를 설명할
 * 방법이 없다 — 없는 구분을 이름으로 만들지 않는다.
 */
export const REPORT_STATE_LABEL: Record<ReportState, string> = {
  analyzing: '분석 중',
  verifying: '확인 중',
  need_user_confirm: '확인이 필요해요',
  under_review: '확인 중',
  needs_supplement: '보완 필요',
  verified: '확인 완료',
  rejected: '반영되지 않았어요',
  canceled: '취소됨',
  deleted: '삭제됨',
};

/**
 * 이 표를 지나지 않고 화면에 나가도 되는 말. 둘뿐이고 둘 다 이유가 있다.
 *
 *   - `게시됨` — 반론이 **실제로 붙어 있다**는 것은 `확인 완료`와 다른 사실이다.
 *     확인은 끝났는데 아직 안 붙어 있을 수 있고, 낸 사람이 알고 싶은 것은 자기
 *     글이 지금 후기 아래에 보이느냐다.
 *   - `종료됨` — 문의는 답을 받은 뒤에도 더 주고받을 수 있다. `종료됨`은 그
 *     주고받기가 끝났다는 뜻이라 `확인 완료`와 겹치지 않는다.
 *
 * 늘리려면 여기에 이유를 적는다. 이유를 못 적겠으면 그건 표에 있는 상태다.
 */
export const REPORT_STATE_EXCEPTIONS = ['게시됨', '종료됨'] as const;

/** 이 문구가 표시 정책을 따르는가. 시험이 흐름마다 이걸 묻는다. */
export function followsStatePolicy(label: string): boolean {
  return (
    Object.values(REPORT_STATE_LABEL).includes(label) ||
    (REPORT_STATE_EXCEPTIONS as readonly string[]).includes(label)
  );
}

export function reportStateLabel(state: ReportState): string {
  return REPORT_STATE_LABEL[state];
}
