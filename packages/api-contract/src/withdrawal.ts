import { z } from 'zod';

/**
 * 회원탈퇴. 디자인 핸드오프 WP-MY-008.
 *
 * **화면이 개수를 짐작하지 않는다.** `Pick한 곳 8곳`은 서버가 센 값이어야 한다 —
 * 짐작한 숫자를 보고 누른 사람은 자기가 무엇을 지우는지 모른 채 누른 것이다.
 *
 * 그래서 안내에 들어갈 줄을 서버가 만들어 보낸다. 문구가 세 곳(화면 · 이용약관
 * 제12조 · 개인정보처리방침)에서 같아야 하고, 화면마다 조립하면 언젠가 갈라진다.
 */

const withdrawalRowSchema = z.object({
  label: z.string(),
  value: z.string(),
  /** 지울 것이 없는 줄. 화면이 흐리게 그린다. */
  empty: z.boolean().optional(),
});

const withdrawalKeptRowSchema = z.object({
  label: z.string(),
  note: z.string(),
  /** 작성자 정보와 분리돼 유지되는 것. 배지가 붙는다. */
  anonymous: z.boolean(),
});

export const withdrawalNoticeSchema = z.object({
  /** 배우자가 있으면 그 사실부터 말한다. 함께 만든 기록이 함께 사라지기 때문이다. */
  lead: z.string(),
  hasPartner: z.boolean(),

  deleted: z.array(withdrawalRowSchema),
  separated: z.array(withdrawalKeptRowSchema),

  /** 탈퇴가 끝나면 완료 화면이 적을 줄. 미리 받아두고 그대로 보여준다. */
  done: z.array(z.string()),
});

export const withdrawalResultSchema = z.object({
  /**
   * 계정 행까지 지워졌는가.
   *
   * false여도 그 사람은 이미 들어올 수 없다 — 로그인 수단과 세션이 함께 사라졌다.
   * 원본 파기가 남았을 뿐이고, 파기 워커가 끝내면 계정 행도 사라진다.
   */
  completed: z.boolean(),
  done: z.array(z.string()),
});

export type WithdrawalNotice = z.infer<typeof withdrawalNoticeSchema>;
export type WithdrawalResult = z.infer<typeof withdrawalResultSchema>;
