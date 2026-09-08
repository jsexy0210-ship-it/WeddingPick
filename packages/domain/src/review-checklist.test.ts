import {
  CHECKLIST_CAPTION,
  CHECKLIST_MINIMUM_ANSWERS,
  CHECKLIST_WARNING_BELOW,
  checklistFor,
  evaluationModeFor,
  isCollecting,
  needsAttentionColor,
  scoreChecklist,
  type ChecklistAnswer,
} from './review-checklist';

const answers = (item: string, list: ChecklistAnswer[]) =>
  list.map((answer) => ({ item, answer }));

describe('업종이 평가 방식을 정한다', () => {
  it('결정사는 체크리스트다', () => {
    expect(evaluationModeFor('wedding_info_company')).toBe('checklist');
    expect(checklistFor('wedding_info_company').length).toBeGreaterThan(0);
  });

  it('웨딩홀과 스튜디오·드레스·메이크업은 별점이다', () => {
    /*
     * 체크리스트 항목(가격설명·계약일치·매칭이행·과도권유)은 결정사 계약에만 있는
     * 것이라 웨딩홀 음식이나 스튜디오 보정에는 쓸 수 없다.
     */
    expect(evaluationModeFor('hall')).toBe('rating');
    expect(evaluationModeFor('studio')).toBe('rating');
    expect(evaluationModeFor('dress')).toBe('rating');
    expect(evaluationModeFor('makeup')).toBe('rating');
    expect(checklistFor('hall')).toEqual([]);
  });
});

describe('체크리스트 환산', () => {
  const enough = CHECKLIST_MINIMUM_ANSWERS;

  it('모름은 분모에서 뺀다', () => {
    // 모르는 것을 0으로 세면 비율이 늘 낮게 나온다. 별점이 못 하는 일이 이것이다.
    const scores = scoreChecklist(
      'wedding_info_company',
      answers('price_explained', [
        ...Array.from<ChecklistAnswer>({ length: enough }).fill('yes'),
        'unknown',
        'unknown',
      ])
    );

    const item = scores.find((score) => score.key === 'price_explained')!;

    expect(item.percent).toBe(100);
    expect(item.answered).toBe(enough);
    expect(item.unknown).toBe(2);
  });

  it('예가 나쁜 답인 항목을 뒤집어 센다', () => {
    /*
     * "과도하게 권유받았나요?"에 예는 나쁜 답이다. 전부 예=좋음으로 세면 강권하는
     * 업체가 높은 점수를 받는다.
     */
    const pushed = scoreChecklist(
      'wedding_info_company',
      answers('pushed_too_hard', Array.from<ChecklistAnswer>({ length: enough }).fill('yes'))
    ).find((score) => score.key === 'pushed_too_hard')!;

    const notPushed = scoreChecklist(
      'wedding_info_company',
      answers('pushed_too_hard', Array.from<ChecklistAnswer>({ length: enough }).fill('no'))
    ).find((score) => score.key === 'pushed_too_hard')!;

    expect(pushed.percent).toBe(0);
    expect(notPushed.percent).toBe(100);
  });

  it('나머지 항목은 예가 좋은 답이다', () => {
    const item = scoreChecklist(
      'wedding_info_company',
      answers('contract_matched', Array.from<ChecklistAnswer>({ length: enough }).fill('yes'))
    ).find((score) => score.key === 'contract_matched')!;

    expect(item.percent).toBe(100);
  });

  it('표본이 모자라면 수집 중이다', () => {
    // 표본이 모자란 100%는 정보가 아니다.
    const item = scoreChecklist(
      'wedding_info_company',
      answers(
        'price_explained',
        Array.from<ChecklistAnswer>({ length: enough - 1 }).fill('yes')
      )
    ).find((score) => score.key === 'price_explained')!;

    expect(isCollecting(item)).toBe(true);
    // 숫자를 만들지 않는다.
    expect(item.percent).toBe(0);
  });

  it('모름만 잔뜩 있어도 수집 중이다', () => {
    const item = scoreChecklist(
      'wedding_info_company',
      answers('price_explained', Array.from<ChecklistAnswer>({ length: 20 }).fill('unknown'))
    ).find((score) => score.key === 'price_explained')!;

    expect(isCollecting(item)).toBe(true);
    expect(item.unknown).toBe(20);
  });

  it('기준 아래면 주의색으로 표시한다', () => {
    // 핸드오프 8번이 정한 값이다. 우리가 정한 것이 아니다.
    const half: ChecklistAnswer[] = [
      ...Array.from<ChecklistAnswer>({ length: 3 }).fill('yes'),
      ...Array.from<ChecklistAnswer>({ length: 3 }).fill('no'),
    ];

    const item = scoreChecklist(
      'wedding_info_company',
      answers('price_explained', half)
    ).find((score) => score.key === 'price_explained')!;

    expect(item.percent).toBeLessThan(CHECKLIST_WARNING_BELOW);
    expect(needsAttentionColor(item)).toBe(true);
  });

  it('항목 목록 순서를 그대로 지킨다', () => {
    // 볼 때마다 순서가 바뀌면 같은 업체를 두 번 보고 다르다고 느낀다.
    const scores = scoreChecklist('wedding_info_company', []);

    expect(scores.map((score) => score.key)).toEqual(
      checklistFor('wedding_info_company').map((item) => item.key)
    );
  });

  it('별점이 아니라고 화면에 적는다', () => {
    expect(CHECKLIST_CAPTION).toContain('별점이 아니라');
  });
});
