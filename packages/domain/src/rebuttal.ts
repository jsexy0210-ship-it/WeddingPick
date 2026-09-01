/**
 * 업체 반론. 디자인 핸드오프 20번.
 *
 * 후기에 대한 업체의 답변이다. 정보통신망법 제44조의2의 임시조치(후기를 가리는
 * 길)와 **다른 길이다** — 임시조치는 글을 가리고 반론은 글 옆에 말을 더한다.
 * 더하는 쪽이 낫다: 읽는 사람이 양쪽을 다 본다.
 *
 * **자동 게시는 없다.** 사람이 확인하기 전에는 후기 옆에 붙지 않는다. 확인하는
 * 것은 두 가지다 — 낸 사람이 정말 그 업체인지, 그리고 그 글이 반론인지.
 */

export const REBUTTAL_STATUSES = ['pending', 'published', 'rejected'] as const;

export type RebuttalStatus = (typeof REBUTTAL_STATUSES)[number];

/**
 * 사용자에게 나가는 말. 표시 정책(`report-state.ts`)을 따른다.
 *
 * `게시됨`만 그 표 밖에 있다. `확인 완료`와 다른 사실이라서다 — 확인은 끝났는데
 * 아직 안 붙어 있을 수 있고, 낸 사람이 알고 싶은 것은 자기 글이 지금 후기 아래에
 * 보이느냐다.
 */
export const REBUTTAL_STATUS_LABEL: Record<RebuttalStatus, string> = {
  pending: '확인 중',
  published: '게시됨',
  rejected: '반영되지 않았어요',
};

/** 낸 사람에게 보이는 상태 설명. 심사가 어디까지 왔는지 말해준다. */
export const REBUTTAL_STATUS_NOTE: Record<RebuttalStatus, string> = {
  pending: '보내주신 내용을 확인하고 있어요. 확인이 끝나면 알림으로 알려드려요',
  published: '후기 아래에 함께 표시되고 있어요',
  rejected: '확인 결과 게시하지 않기로 했어요. 사유를 함께 보내드렸어요',
};

export const MIN_REBUTTAL_BODY_LENGTH = 20;

export const REBUTTAL_HEADLINE = '사실과 다른 내용이\n있다면 알려주세요';
export const REBUTTAL_ROLE_HINT = '가온예식홀 예약팀장';
export const REBUTTAL_BODY_HINT = '어떤 부분이 사실과 다른지 적어주세요';

/**
 * 사람이 확인하기 전이라는 것을 낸 사람에게 먼저 말한다.
 *
 * 넣자마자 붙는 줄 알고 기다리면, 안 붙은 것이 고장으로 보인다.
 */
export const REBUTTAL_REVIEW_NOTICE =
  '보내주신 내용은 담당자가 확인한 뒤에 후기 아래에 표시돼요. 바로 게시되지는 않아요';

export type RebuttalCheck = { ok: true } | { ok: false; message: string };

export function checkRebuttal(input: { claimedRole: string; body: string }): RebuttalCheck {
  if (input.claimedRole.trim().length === 0) {
    /*
     * 누가 하는 말인지 모르는 반론은 후기 옆에 붙을 자격이 없다 — 그건 반론이
     * 아니라 또 하나의 익명 글이다.
     */
    return { ok: false, message: '업체와 어떤 관계인지 적어주세요' };
  }

  if (input.body.trim().length < MIN_REBUTTAL_BODY_LENGTH) {
    return {
      ok: false,
      message: `어떤 부분이 사실과 다른지 ${MIN_REBUTTAL_BODY_LENGTH}자 이상 적어주세요`,
    };
  }

  return { ok: true };
}

/** 낸 사람이 고칠 수 있는 때. 심사가 끝난 글은 고칠 수 없다. */
export function isEditable(status: RebuttalStatus): boolean {
  /*
   * 게시된 뒤에 본문을 바꿀 수 있게 두면, 확인받은 글과 실제로 붙어 있는 글이
   * 달라진다. 고치려면 다시 확인받아야 한다.
   */
  return status === 'pending';
}
