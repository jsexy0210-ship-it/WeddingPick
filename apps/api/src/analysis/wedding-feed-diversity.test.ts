import {
  FEED_IMAGE_DUPLICATE_BITS,
  FEED_IMAGE_MIN_PLAN_DISTANCE,
  FEED_IMAGE_PEOPLE_RULE,
  FEED_TEXT_DUPLICATE_THRESHOLD,
  chooseFeedImagePlan,
  coveredListText,
  dHashFromGray,
  feedImagePlanDistance,
  feedImagePlanLines,
  feedImagePlanSignature,
  feedTextSimilarity,
  findNearDuplicate,
  hammingDistanceHex,
  keyPointsOf,
  parseFeedImagePlan,
  type FeedImagePlan,
  type FeedTextSample,
} from './wedding-feed-diversity';

/**
 * 웨딩피드 겹침 방지 — 2026-09-26 대표 지시 「같은 카테고리 이전 내용을 분석해서 중첩되지
 * 않는 내용으로 생성한다」 · 「이미지도 … 다르게 생성되어야한다」 · 「가상 모델은 동양인
 * 한국인 기준으로만 생성한다」.
 *
 * 한도(0.40)의 근거가 여기 표본이다. 표본을 바꾸면 한도의 근거도 바뀐다 — 주석과 같이 고친다.
 */

type Pair = [category: string, a: FeedTextSample, b: FeedTextSample];

/** 같은 내용을 말만 바꾼 쌍 — 버려야 한다. */
const NEAR_DUPLICATES: Pair[] = [
  ['웨딩홀', { title: '웨딩홀 투어에서 꼭 물어볼 것', summary: '보증인원과 식대 인상 조건을 먼저 확인하세요.' }, { title: '웨딩홀 투어 때 꼭 물어봐야 할 질문', summary: '식대 인상 조건과 보증인원부터 확인하세요.' }],
  ['예산', { title: '스드메 예산을 넘기지 않게 짜는 방법', summary: '항목별로 먼저 상한을 정해두면 흔들리지 않아요.' }, { title: '스드메 예산 넘기지 않고 짜는 법', summary: '항목별 상한을 먼저 정해두면 예산이 흔들리지 않아요.' }],
  ['드레스', { title: '드레스 피팅 전에 알아둘 것', summary: '피팅 횟수와 추가 비용을 미리 확인하세요.' }, { title: '드레스 피팅 가기 전 알아두면 좋은 것', summary: '추가 비용과 피팅 횟수를 먼저 확인해보세요.' }],
  ['본식스냅', { title: '본식스냅 고를 때 보는 것', summary: '원본 제공 여부와 촬영 인원을 확인하세요.' }, { title: '본식스냅 고르기 전에 볼 것', summary: '촬영 인원과 원본 제공 여부부터 확인하세요.' }],
  ['메이크업', { title: '메이크업 리허설을 보는 법', summary: '리허설에서 피부 표현과 지속력을 확인하세요.' }, { title: '메이크업 리허설 제대로 보는 방법', summary: '지속력과 피부 표현을 리허설에서 꼭 확인해요.' }],
  ['허니문', { title: '허니문 일정을 짜는 순서', summary: '항공권과 숙소를 먼저 정하고 일정을 채워요.' }, { title: '허니문 일정 짜는 순서 정리', summary: '숙소와 항공권부터 정한 뒤 일정을 채워요.' }],
  ['체크리스트', { title: '본식 4개월 전에 정리할 것', summary: '본식스냅과 헤어변형을 이때 정해요.' }, { title: '본식 4개월 전 체크리스트', summary: '본식스냅, 헤어변형 예약을 이때 마쳐요.' }],
];

/** 같은 카테고리의 다른 세부 주제 — 통과해야 한다. 낱말을 일부 나눠 갖는 쌍을 일부러 넣었다. */
const DISTINCT: Pair[] = [
  ['웨딩홀', { title: '웨딩홀 투어에서 꼭 물어볼 것', summary: '보증인원과 식대 인상 조건을 먼저 확인하세요.' }, { title: '보증인원이 무엇이고 어떻게 정하나', summary: '하객 수를 가늠해 보증인원을 정하는 순서예요.' }],
  ['웨딩홀', { title: '웨딩홀 투어에서 꼭 물어볼 것', summary: '보증인원과 식대 인상 조건을 먼저 확인하세요.' }, { title: '웨딩홀 대관료 말고 따로 드는 비용', summary: '꽃장식과 음향, 주차 비용을 따로 확인하세요.' }],
  ['웨딩홀', { title: '웨딩홀 투어에서 꼭 물어볼 것', summary: '보증인원과 식대 인상 조건을 먼저 확인하세요.' }, { title: '웨딩홀 투어 일정을 잡는 순서', summary: '주말 투어는 한 달 전에 예약해 두세요.' }],
  ['예산', { title: '스드메 예산을 넘기지 않게 짜는 방법', summary: '항목별로 먼저 상한을 정해두면 흔들리지 않아요.' }, { title: '예산표를 둘이 함께 관리하는 방법', summary: '지출을 한곳에 적고 매주 같이 확인해요.' }],
  ['예산', { title: '스드메 예산을 넘기지 않게 짜는 방법', summary: '항목별로 먼저 상한을 정해두면 흔들리지 않아요.' }, { title: '웨딩홀 대관료 말고 따로 드는 비용', summary: '꽃장식과 음향 비용을 예산에 먼저 넣어두세요.' }],
  ['드레스', { title: '드레스 피팅 전에 알아둘 것', summary: '피팅 횟수와 추가 비용을 미리 확인하세요.' }, { title: '드레스 대여와 구매 중 고르는 기준', summary: '몇 번 입을지와 보관 방법을 먼저 정해요.' }],
  ['드레스', { title: '드레스 피팅 전에 알아둘 것', summary: '피팅 횟수와 추가 비용을 미리 확인하세요.' }, { title: '체형별로 드레스 라인 고르는 법', summary: '어깨와 허리선을 기준으로 라인을 골라보세요.' }],
  ['본식스냅', { title: '본식스냅 고를 때 보는 것', summary: '원본 제공 여부와 촬영 인원을 확인하세요.' }, { title: '본식스냅 보정본을 받기까지의 일정', summary: '원본 전달부터 보정본 수령까지 걸리는 기간을 확인해요.' }],
  ['스튜디오', { title: '스튜디오 고를 때 보는 것', summary: '촬영 컷 수와 원본 제공 조건을 확인하세요.' }, { title: '원본 제공 조건을 확인하는 법', summary: '원본 파일 수와 전달 방식을 계약 전에 확인하세요.' }],
  ['메이크업', { title: '메이크업 리허설을 보는 법', summary: '리허설에서 피부 표현과 지속력을 확인하세요.' }, { title: '본식 날 메이크업 수정 준비물', summary: '파우치에 넣어둘 것을 미리 챙겨요.' }],
  ['허니문', { title: '허니문 일정을 짜는 순서', summary: '항공권과 숙소를 먼저 정하고 일정을 채워요.' }, { title: '허니문 여행자 보험 확인할 것', summary: '보장 범위와 청구 서류를 떠나기 전에 확인해요.' }],
  ['체크리스트', { title: '본식 4개월 전에 정리할 것', summary: '본식스냅과 헤어변형을 이때 정해요.' }, { title: '본식 한 달 전에 확인할 것', summary: '하객 명단과 식순을 마지막으로 점검해요.' }],
  ['드레스', { title: '드레스 피팅 전에 알아둘 것', summary: '피팅 횟수와 추가 비용을 미리 확인하세요.' }, { title: '드레스에서 따로 드는 비용', summary: '대여 기간 연장과 보정 비용을 계약 전에 물어보세요.' }],
];

describe('웨딩피드 글 겹침 — 한국어 표본', () => {
  it.each(NEAR_DUPLICATES)('%s — 말만 바꾼 같은 글은 한도를 넘는다', (category, a, b) => {
    expect(feedTextSimilarity(a, b, category)).toBeGreaterThanOrEqual(FEED_TEXT_DUPLICATE_THRESHOLD);
  });

  it.each(DISTINCT)('%s — 다른 세부 주제는 한도 아래다', (category, a, b) => {
    expect(feedTextSimilarity(a, b, category)).toBeLessThan(FEED_TEXT_DUPLICATE_THRESHOLD);
  });

  it('같은 글은 1, 공통 글자가 없으면 0', () => {
    const post = { title: '허니문 일정을 짜는 순서', summary: '항공권부터 정해요.' };

    expect(feedTextSimilarity(post, post)).toBe(1);
    expect(feedTextSimilarity(post, { title: '드레스 라인', summary: '체형' })).toBe(0);
  });

  it('카테고리 이름은 비교에서 뺀다 — 같은 묶음의 글이 전부 닮아 보이지 않게', () => {
    const a = { title: '웨딩홀 주차', summary: '' };
    const b = { title: '웨딩홀 조명', summary: '' };

    expect(feedTextSimilarity(a, b)).toBeGreaterThan(feedTextSimilarity(a, b, '웨딩홀'));
    expect(feedTextSimilarity(a, b, '웨딩홀')).toBe(0);
  });

  it('가장 많이 겹치는 이전 글을 돌려주고, 없으면 null', () => {
    const [, original, paraphrase] = NEAR_DUPLICATES[1]!;
    const recent = [DISTINCT[3]![2], original];

    expect(findNearDuplicate(paraphrase, recent, { categoryLabel: '예산' })?.post).toBe(original);
    expect(findNearDuplicate(DISTINCT[4]![2], [original], { categoryLabel: '예산' })).toBeNull();
  });
});

describe('「이미 쓴 글」 목록', () => {
  it('문단마다 첫 문장을 요점으로, 출처 줄은 빼고', () => {
    const body = '먼저 상한을 정해요. 그다음 나눠요.\n\n계약 전 항목별로 받아 적어요.\n\n출처: 서울특별시 2025년 (공공데이터포털)';

    expect(keyPointsOf(body)).toEqual(['먼저 상한을 정해요.', '계약 전 항목별로 받아 적어요.']);
  });

  it('제목 · 요약 · 요점과 쓰지 말 제목을 한 목록으로', () => {
    const text = coveredListText(
      [{ title: '웨딩홀 투어에서 꼭 물어볼 것', summary: '보증인원부터', body: '보증인원을 먼저 물어요.' }],
      ['웨딩홀 투어 질문 정리', '웨딩홀 투어 질문 정리']
    );

    expect(text).toContain('이미 쓴 글(같은 묶음 · 최근 1편)');
    expect(text).toContain('- 웨딩홀 투어에서 꼭 물어볼 것 — 보증인원부터 (요점: 보증인원을 먼저 물어요.)');
    expect(text).toContain('이번에 쓰지 말 제목');
    expect(text.match(/웨딩홀 투어 질문 정리/g)).toHaveLength(1);
  });

  it('이전 글도 피할 제목도 없으면 빈 문자열 — 없는 목록을 적지 않는다', () => {
    expect(coveredListText([], [])).toBe('');
  });
});

/** 시험용 난수 — 같은 씨앗은 같은 순서. */
function seeded(seed: number): () => number {
  let state = seed;

  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2 ** 31;
    return state / 2 ** 31;
  };
}

describe('그림 촬영 계획', () => {
  it('사람 규칙은 한국인(동아시아인) 성인만 · 실존 인물 금지를 한국어와 영어로 적는다', () => {
    expect(FEED_IMAGE_PEOPLE_RULE).toContain('한국인(동아시아인) 성인');
    expect(FEED_IMAGE_PEOPLE_RULE).toContain('실존 인물');
    expect(FEED_IMAGE_PEOPLE_RULE).toContain('Korean (East Asian) adult');
    expect(FEED_IMAGE_PEOPLE_RULE).toContain('celebrities');
  });

  it('같은 카테고리에서 30장을 이어 만들어도 같은 조합이 다시 나오지 않고, 바로 앞 다섯 장과 네 칸 이상 다르다', () => {
    const random = seeded(7);
    const history: FeedImagePlan[] = [];

    for (let i = 0; i < 30; i += 1) {
      const plan = chooseFeedImagePlan({ categoryLabel: '웨딩홀', recent: history, random });

      expect(history.map(feedImagePlanSignature)).not.toContain(feedImagePlanSignature(plan));
      for (const previous of history.slice(0, 5)) {
        expect(feedImagePlanDistance(plan, previous)).toBeGreaterThanOrEqual(FEED_IMAGE_MIN_PLAN_DISTANCE);
      }
      history.unshift(plan);
    }

    /* 칸마다 여러 값이 고루 쓰인다 — 한 값으로 몰리지 않는다. */
    const count = (dimension: keyof FeedImagePlan) => new Set(history.map((plan) => plan[dimension])).size;

    expect(count('scene')).toBe(7); // 웨딩홀 장소 7개를 다 쓴다
    expect(count('shot')).toBeGreaterThanOrEqual(7);
    expect(count('palette')).toBe(8);
    expect(count('people')).toBe(4);
  });

  it('바로 앞 그림과 같은 장소 · 구도 · 색감을 고르지 않는다', () => {
    const previous: FeedImagePlan = {
      scene: 'chapel', shot: 'wide', timeOfDay: 'golden', season: 'spring',
      palette: 'ivory-gold', props: 'bouquet', people: 'couple',
    };

    for (let seed = 1; seed <= 300; seed += 1) {
      const plan = chooseFeedImagePlan({ categoryLabel: '웨딩홀', recent: [previous], random: seeded(seed) });

      expect(plan.scene).not.toBe('chapel');
      expect(plan.shot).not.toBe('wide');
      expect(plan.palette).not.toBe('ivory-gold');
    }
  });

  it('사람이 없는 계획에는 인물 구도와 「소품 없음」을 고르지 않는다', () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      const plan = chooseFeedImagePlan({ categoryLabel: '예산', recent: [], random: seeded(seed) });

      if (plan.people === 'none') {
        expect(['medium', 'full', 'over-shoulder', 'candid']).not.toContain(plan.shot);
        expect(plan.props).not.toBe('none');
      }
    }
  });

  it('모르는 카테고리는 일반 장소에서 고른다 — 새 카테고리를 막지 않는다', () => {
    const plan = chooseFeedImagePlan({ categoryLabel: '한복', recent: [], random: seeded(3) });

    expect(['home-table', 'cafe', 'desk', 'sofa', 'park-bench', 'balcony', 'consult-room']).toContain(plan.scene);
  });

  it('계획을 모델에게 줄 줄로 — 일곱 칸 모두', () => {
    const lines = feedImagePlanLines({
      scene: 'beach', shot: 'closeup', timeOfDay: 'morning', season: 'summer',
      palette: 'vivid', props: 'luggage', people: 'couple',
    });

    expect(lines).toEqual([
      '- 장소: 에메랄드빛 해변',
      '- 구도: 손과 소품에 바짝 다가간 클로즈업',
      '- 시간대와 빛: 맑은 아침 햇살',
      '- 계절: 여름 — 짙은 초록과 강한 햇빛',
      '- 색감: 선명한 원색이 한두 군데 들어간 밝은 색',
      '- 소품: 여행 가방과 밀짚모자',
      '- 인물: 예비 부부 두 사람',
    ]);
  });

  it('저장된 계획이 깨졌으면 쓰지 않는다', () => {
    expect(parseFeedImagePlan({ scene: 'beach' })).toBeNull();
    expect(parseFeedImagePlan(null)).toBeNull();
  });
});

/** 합성 회색조 그림. */
function image(width: number, height: number, pixel: (x: number, y: number) => number): Uint8Array {
  const out = new Uint8Array(width * height);

  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) out[y * width + x] = pixel(x, y);
  return out;
}

describe('그림 지문(dHash)', () => {
  const W = 160;
  const H = 90;
  const scene = (x: number, y: number) => Math.round(128 + 100 * Math.sin(x / 13) * Math.cos(y / 9));

  it('같은 그림을 밝게 하거나 잡음을 넣어도 한도 안이다', () => {
    const base = dHashFromGray(image(W, H, scene), W, H);
    const brighter = dHashFromGray(image(W, H, (x, y) => Math.min(255, scene(x, y) + 20)), W, H);
    const noisy = dHashFromGray(image(W, H, (x, y) => Math.max(0, Math.min(255, scene(x, y) + ((x * 7 + y * 3) % 5) - 2))), W, H);

    expect(base).toMatch(/^[0-9a-f]{16}$/);
    expect(hammingDistanceHex(base, brighter)).toBeLessThanOrEqual(FEED_IMAGE_DUPLICATE_BITS);
    expect(hammingDistanceHex(base, noisy)).toBeLessThanOrEqual(FEED_IMAGE_DUPLICATE_BITS);
  });

  it('구도가 다른 그림은 한도를 넘는다', () => {
    const base = dHashFromGray(image(W, H, scene), W, H);
    const mirrored = dHashFromGray(image(W, H, (x, y) => scene(W - 1 - x, y)), W, H);
    const gradient = dHashFromGray(image(W, H, (x) => 255 - Math.round((x / W) * 255)), W, H);

    expect(hammingDistanceHex(base, mirrored)).toBeGreaterThan(FEED_IMAGE_DUPLICATE_BITS);
    expect(hammingDistanceHex(base, gradient)).toBeGreaterThan(FEED_IMAGE_DUPLICATE_BITS);
  });

  it('깨진 지문은 전혀 다른 것(64)으로 본다', () => {
    expect(hammingDistanceHex('ffff', '0000000000000000')).toBe(64);
    expect(hammingDistanceHex('ffffffffffffffff', '0000000000000000')).toBe(64);
    expect(hammingDistanceHex('0f0f0f0f0f0f0f0f', '0f0f0f0f0f0f0f0f')).toBe(0);
  });
});
