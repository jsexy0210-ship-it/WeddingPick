import type { InquiryCategory } from './inquiry';

import { DISCLOSURE_THRESHOLDS } from './disclosure';
import { formatCount } from './format-number';

/**
 * 자주 묻는 것. 디자인 핸드오프 20번 — 문의하기 위에 아코디언으로 둔다.
 *
 * **2026-09-16 대표 지시로 항목 자체가 여기서 빠졌다** — 「관리자 faq처럼 이미 코드로
 * 등록되어 있는것도 내가 직접 수정 삭제 가능하도록 하라고」. 질문과 답은 이제
 * `structured.faq_items`에 있고 관리자 화면에서 고치고 지운다. 초기값은 마이그레이션
 * `0420_faq_seed_from_code.sql`이 넣었다.
 *
 * **그런데 답 하나에는 계산이 들어 있었다.** `price-source`의 답은 공개 기준 건수를
 * 문장에 계산해 넣는다. 그 문장을 글자로 복사해 표에 두면 기준이 바뀌는 날 사본이 옛
 * 수를 말하고, 문장이라서 아무도 고장으로 보지 않는다 — 0230 마이그레이션이 코드
 * 항목을 잠가 둔 이유가 그것이었다.
 *
 * **그래서 표에는 자리표시자를 담았다.** 답에 `{{limited}}`라고 적어 두고 보여줄 때
 * 아래 `fillFaqPlaceholders`가 `DISCLOSURE_THRESHOLDS`에서 값을 채운다. 대표님이
 * 문장을 마음대로 고쳐도 숫자는 코드에서 온다. 잘못된 이름은 저장할 때 막는다
 * (`unknownFaqPlaceholders`) — 화면에 `{{limitedd}}`가 그대로 나가면 그것도 아무도
 * 고장으로 보지 않는다.
 *
 * 여기 남은 둘은 글이 아니라 **동작**이다. 어느 문의 유형으로 보낼지와 어느 질문을
 * 같이 보여줄지는 화면의 분기라서 표로 옮기지 않는다.
 *
 * 지금 FAQ에 빠져 있는 것 둘과 그 이유(등록하려면 먼저 정해져야 한다):
 *
 *   - **문의 회신 기한** — 서비스정책서가 아직 안 정했다.
 *   - **탈퇴 뒤 자료가 어떻게 되는가** — 개인정보처리방침이 아직 작성 전이다
 *     (`policies.ts`의 `privacy` 상태가 `작성 필요`). 먼저 "작성자를 알아볼 수 없게
 *     분리해 유지합니다" 같은 문장을 적으면 그것이 근거 없는 약속이 되고, 나중에
 *     방침이 다르게 정해지면 우리가 거짓말한 것이 된다.
 */

export type FaqItem = {
  key: string;
  question: string;
  answer: string;
};

/* ── 답 안에 값을 채우는 자리 ──────────────────────────────────────────── */

/**
 * 답에 쓸 수 있는 자리표시자와 그 값.
 *
 * **여기가 유일한 목록이다.** 화면도 서버도 이것을 부른다 — 두 군데에 적어 두면
 * 관리자 화면이 「쓸 수 있다」고 적어 둔 이름을 서버가 모르는 날이 온다.
 */
export const FAQ_PLACEHOLDER_VALUES: Readonly<Record<string, string>> = {
  limited: formatCount(DISCLOSURE_THRESHOLDS.limited),
  normal: formatCount(DISCLOSURE_THRESHOLDS.normal),
  detailed: formatCount(DISCLOSURE_THRESHOLDS.detailed),
};

/** 관리자 화면이 「쓸 수 있는 이름」으로 적어 두는 설명. 외우게 하지 않는다. */
export const FAQ_PLACEHOLDER_LABEL: Readonly<Record<string, string>> = {
  limited: '실 제보가 몇 건부터 구간을 보여주는지',
  normal: '실 제보가 몇 건부터 적다는 안내를 떼는지',
  detailed: '실 제보가 몇 건부터 기준금액까지 보여주는지',
};

export const FAQ_PLACEHOLDER_NAMES: readonly string[] = Object.keys(FAQ_PLACEHOLDER_VALUES);

/**
 * `{{이름}}`을 찾는다.
 *
 * 닫는 괄호까지 있는 것만 잡는다. 안쪽 공백은 다듬어 읽는다 — `{{ limited }}`라고
 * 적은 것을 「모르는 이름」으로 돌려보내면 대표님은 무엇이 틀렸는지 알 수 없다.
 */
const PLACEHOLDER_RE = /\{\{([^{}]*)\}\}/g;

/** 짝이 맞지 않는 `{{`. 이것도 그대로 화면에 나가므로 저장할 때 막는다. */
const OPENER_RE = /\{\{/g;

/**
 * 답에 든 자리표시자를 값으로 바꾼다.
 *
 * 모르는 이름은 **그대로 둔다** — 여기서 빈 문자열로 지우면 문장이 조용히 말을 바꾼다
 * ("실 제보가 건 모이면"). 저장할 때 막는 것이 이 함수의 짝이다.
 */
export function fillFaqPlaceholders(text: string): string {
  return text.replace(PLACEHOLDER_RE, (whole, name: string) => {
    const value = FAQ_PLACEHOLDER_VALUES[name.trim()];

    return value ?? whole;
  });
}

/**
 * 채울 수 없는 자리표시자를 모아 돌려준다. 없으면 빈 배열이다.
 *
 * 저장 경로가 이것을 보고 400으로 돌려보낸다. 사용자 화면에 `{{limitedd}}`가 그대로
 * 나가면 아무도 고장으로 보지 않는다 — 그 글자를 문구의 일부로 읽고 지나간다.
 *
 * 짝이 맞지 않는 `{{`도 여기서 걸린다. 여는 괄호 수와 잡힌 수가 다르면 닫히지 않은
 * 것이 있다는 뜻이고, 그 뒤 문장은 통째로 화면에 그대로 나간다.
 */
export function unknownFaqPlaceholders(text: string): string[] {
  const found: string[] = [];
  let matched = 0;

  for (const [, name] of text.matchAll(PLACEHOLDER_RE)) {
    matched += 1;

    const trimmed = (name ?? '').trim();

    if (!(trimmed in FAQ_PLACEHOLDER_VALUES) && !found.includes(trimmed)) found.push(trimmed);
  }

  if ((text.match(OPENER_RE) ?? []).length !== matched) found.push('{{');

  return found;
}

/* ── 질문 하나를 열었을 때 (WP-FAQ-003) ────────────────────────────────── */

/**
 * 「해결되지 않았어요」를 누르면 어느 문의 유형으로 보낼 것인가.
 *
 * 시안 WP-FAQ-003의 규칙이다 — 답이 도움이 안 됐으면 그 질문이 무엇에 관한
 * 것이었는지 우리가 이미 안다. 유형을 다시 고르게 하는 것은 같은 말을 두 번
 * 시키는 일이다.
 *
 * **글이 아니라 분기라서 표로 옮기지 않았다.** 값이 `InquiryCategory`라 표에 두면
 * 코드가 모르는 유형이 들어올 수 있고, 그러면 문의가 엉뚱한 큐로 접수된다.
 *
 * 짝이 없으면 `other`로 간다. 관리자가 새로 등록한 항목은 여기에 없으므로 `other`다.
 */
export const FAQ_UNRESOLVED_CATEGORY: Record<string, InquiryCategory> = {
  'price-source': 'data_correction',
  'why-locked': 'other',
  'original-image': 'privacy',
  'who-sees': 'privacy',
  'review-hidden': 'other',
  'vendor-rebuttal': 'vendor_objection',
  spouse: 'other',
};

/**
 * 이 질문과 같이 볼 만한 질문들. 시안 WP-FAQ-003의 「관련 질문」.
 *
 * 자동으로 고르지 않는다 — 제목이 비슷하다고 관련된 것이 아니고, 엉뚱한 질문을
 * 붙이면 답을 찾던 사람이 한 번 더 헤맨다. 사람이 짝지어 둔다.
 *
 * 관리자가 새로 등록한 항목은 여기에 없어 관련 질문이 비어 있다. 비어 있으면 화면이
 * 그 칸을 그리지 않는다 — 억지로 붙이는 것보다 낫다.
 */
export const FAQ_RELATED: Record<string, readonly string[]> = {
  'price-source': ['who-sees', 'why-locked'],
  'why-locked': ['price-source', 'original-image'],
  'original-image': ['who-sees', 'why-locked'],
  'who-sees': ['original-image', 'price-source'],
  'review-hidden': ['vendor-rebuttal'],
  'vendor-rebuttal': ['review-hidden'],
  spouse: [],
};

/** 받아 둔 목록에서 키로 질문 하나를 찾는다. 없으면 undefined — 화면이 「찾지 못했어요」로 답한다. */
export function faqItem<T extends { key: string }>(
  items: readonly T[],
  key: string | undefined
): T | undefined {
  return items.find((item) => item.key === key);
}
