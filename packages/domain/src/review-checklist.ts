import type { VendorCategory } from './vendor';

/**
 * 결정사 업체평가 — 체크리스트.
 *
 * 디자인 핸드오프 8번: "별점이 아니라 체크리스트 응답을 환산한 값이에요".
 * 항목은 05a 5.5가 정해뒀다.
 *
 * **왜 결정사만 다른가.** 05a는 결정사 단일 서비스 기준으로 쓰인 문서이고, 그
 * 항목들(가격설명·계약일치·매칭이행·과도권유)은 결정사 계약에만 있는 것이다.
 * 웨딩홀 음식이나 스튜디오 보정에는 쓸 수 없다. 그래서 업종으로 가른다 —
 * 한 벌로 억지로 맞추면 둘 다 흐려진다.
 *
 * **체크리스트가 별점보다 나은 점이 하나 있다: "모름"을 셀 수 있다.** 별점은
 * 모르는 것도 3점쯤으로 찍히고 그게 평균에 들어간다. 여기서는 모름이 분모에서
 * 빠지므로, 아는 사람만 답한 값이 된다.
 */

export const CHECKLIST_ANSWERS = ['yes', 'no', 'unknown'] as const;

export type ChecklistAnswer = (typeof CHECKLIST_ANSWERS)[number];

export const CHECKLIST_ANSWER_LABEL: Record<ChecklistAnswer, string> = {
  yes: '예',
  no: '아니오',
  unknown: '모름',
};

export type ChecklistItem = {
  key: string;
  /** 항목 이름. 화면의 ProgressBar 왼쪽에 붙는다. */
  label: string;
  /** 실제로 묻는 문장. */
  question: string;
  /**
   * '예'가 좋은 답인가.
   *
   * **이 필드가 없으면 점수가 뒤집힌다.** "과도하게 권유받았나요?"에 '예'는 나쁜
   * 답이다. 전부 예=좋음으로 세면 강권하는 업체가 높은 점수를 받는다.
   */
  yesIsGood: boolean;
};

export const REVIEW_CHECKLIST: Partial<Record<VendorCategory, readonly ChecklistItem[]>> = {
  wedding_info_company: [
    {
      key: 'price_explained',
      label: '가격 설명',
      question: '가입 전에 총 비용과 추가비용을 알려주었나요?',
      yesIsGood: true,
    },
    {
      key: 'contract_matched',
      label: '계약 일치',
      question: '설명받은 조건이 계약서와 같았나요?',
      yesIsGood: true,
    },
    {
      key: 'matching_fulfilled',
      label: '매칭 이행',
      question: '약정한 소개 횟수를 채워주었나요?',
      yesIsGood: true,
    },
    {
      key: 'operating_normally',
      label: '운영 정상성',
      question: '연락과 일정 잡기가 막힘없이 되었나요?',
      yesIsGood: true,
    },
    {
      key: 'pushed_too_hard',
      label: '과도한 권유',
      // '예'가 나쁜 답이다. yesIsGood이 false인 유일한 항목.
      question: '가입이나 상위 상품을 부담스럽게 권유받았나요?',
      yesIsGood: false,
    },
    {
      key: 'handled_termination',
      label: '담당 변경·해지 대응',
      question: '담당자 변경이나 해지 요청을 제대로 처리해 주었나요?',
      yesIsGood: true,
    },
  ],
};

/** 업체평가를 무엇으로 받는가. */
export type EvaluationMode = 'checklist' | 'rating';

export function evaluationModeFor(category: VendorCategory): EvaluationMode {
  return REVIEW_CHECKLIST[category] ? 'checklist' : 'rating';
}

export function checklistFor(category: VendorCategory): readonly ChecklistItem[] {
  return REVIEW_CHECKLIST[category] ?? [];
}

/**
 * 항목 하나의 환산 점수.
 *
 * `answered`가 분모다 — **'모름'은 빠진다.** 그 수를 함께 내보내는 이유는, 두 명이
 * 답한 100%와 스무 명이 답한 100%가 같은 값으로 보이면 안 되기 때문이다.
 */
export type ChecklistScore = {
  key: string;
  label: string;
  /** 0~100. 좋은 답의 비율이다. */
  percent: number;
  answered: number;
  unknown: number;
};

/**
 * 항목이 주황으로 보이는 기준. 디자인 핸드오프 8번이 정한 값이다.
 *
 * 우리가 정한 값이 아니라 받아 적은 값이다.
 */
export const CHECKLIST_WARNING_BELOW = 70;

/** 항목별로 몇 건이 모여야 숫자를 만드는가. 모자라면 "수집 중"이다. */
export const CHECKLIST_MINIMUM_ANSWERS = 5;

export const CHECKLIST_COLLECTING_LABEL = '수집 중';

export function scoreChecklist(
  category: VendorCategory,
  answers: readonly { item: string; answer: ChecklistAnswer }[]
): ChecklistScore[] {
  const items = checklistFor(category);

  return items.flatMap((item) => {
    const forItem = answers.filter((answer) => answer.item === item.key);
    // '모름'은 분모에서 뺀다. 모르는 것을 0으로 세면 비율이 늘 낮게 나온다.
    const answered = forItem.filter((answer) => answer.answer !== 'unknown');

    if (answered.length < CHECKLIST_MINIMUM_ANSWERS) {
      return [
        {
          key: item.key,
          label: item.label,
          percent: 0,
          answered: answered.length,
          unknown: forItem.length - answered.length,
        },
      ];
    }

    /*
     * 좋은 답이 무엇인지는 항목이 안다. 전부 예=좋음으로 세면 "과도하게
     * 권유받았나요?"에 예라고 답할수록 점수가 올라간다.
     */
    const good = answered.filter((answer) =>
      item.yesIsGood ? answer.answer === 'yes' : answer.answer === 'no'
    );

    return [
      {
        key: item.key,
        label: item.label,
        percent: Math.round((good.length / answered.length) * 100),
        answered: answered.length,
        unknown: forItem.length - answered.length,
      },
    ];
  });
}

/** 이 항목의 숫자를 보여줘도 되는가. 모자라면 "수집 중"으로 적는다. */
export function isCollecting(score: ChecklistScore): boolean {
  return score.answered < CHECKLIST_MINIMUM_ANSWERS;
}

export function needsAttentionColor(score: ChecklistScore): boolean {
  return !isCollecting(score) && score.percent < CHECKLIST_WARNING_BELOW;
}

/** 화면에 함께 나가는 말. 핸드오프 8번이 문구까지 정했다. */
export const CHECKLIST_CAPTION = '별점이 아니라 체크리스트 응답을 환산한 값이에요';
