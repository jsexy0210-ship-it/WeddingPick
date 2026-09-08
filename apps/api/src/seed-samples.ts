import {
  PREPARATION_CATEGORIES,
  VENDOR_CATEGORY_LABEL,
  aspectsFor,
  checklistFor,
  productKey,
  type VendorCategory,
} from '@weddingpick/domain';
import type { PoolClient } from 'pg';

import { loadConfig } from './config';
import { createPool, withTransaction } from './db';

/**
 * 업종별 샘플 업체 20곳씩 — 화면 검수용(2026-09-08 오더). 준비 순서의 10개 업종
 * (핸드오프 v3.18 §1.3)만 넣고 «기타»는 넣지 않는다 — 사용자 화면에 업종으로
 * 내놓지 않는 칸이라 검수할 화면이 없다.
 *
 *   npm run seed:samples --workspace @weddingpick/api -- --yes
 *   npm run seed:samples --workspace @weddingpick/api -- --remove --yes
 *
 * **지어낸 업체다.** 실제 사업자와 이름이 겹쳐도 우연이다. 진짜 자료와 섞이지
 * 않게 `vendor_source_records(source_key='sample')`로 전부 표시해 두고, `--remove`가
 * 그 표시를 따라 한 번에 걷어낸다. 두 번 돌려도 같은 이름을 만든다(고정 시드
 * 난수) — (정규화 이름, 지역) 유일 제약에 걸려 두 번 들어가지 않는다.
 *
 * 이미지는 구글 검색 결과를 긁지 않는다 — 약관 위반이고 업체 사진은 저작권이
 * 있다. Flickr CC 사진을 키워드로 돌려주는 loremflickr 주소를 쓴다(cc_by).
 * 실제 업체 사진은 «권리 확보 후 교체» 항목 그대로다(핸드오프 보류 목록).
 *
 * 실 제보(결제인증) 건수는 0~2 · 3~4 · 5~9 · 10+ 네 단계가 다 보이게 흩는다
 * (CLAUDE.md §3 «실 제보 4단계») — 한 단계만 있으면 화면이 그 경계를
 * 맞게 그리는지 볼 수 없다.
 */

const SOURCE_KEY = 'sample';
const PER_CATEGORY = 20;
/** 샘플을 넣는 업종 — «기타»만 빠진다. */
type SampleCategory = Exclude<VendorCategory, 'etc'>;
const SAMPLE_CATEGORIES = PREPARATION_CATEGORIES as readonly SampleCategory[];
const REPORTER_COUNT = 40;
/** display_name은 5자까지(users_display_name_check). 진짜 계정과는 identities가 없다는 것으로 가른다. */
const REPORTER_NAME = (n: number) => `제보자${n}`;
const OPERATOR_NAME = '검토운영';
/**
 * `--remove`가 지워야 할 이름. v3.18 전에 넣은 «표본N»·«표본운영»도 이미 심어져
 * 있을 수 있어 옛 이름을 함께 잡는다.
 */
const REPORTER_NAME_PATTERN = '^(표본|제보자)[0-9]+$';
const OPERATOR_NAMES = [OPERATOR_NAME, '표본운영'];

function argv(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

/** mulberry32 — 고정 시드. 돌릴 때마다 같은 업체가 나와야 중복이 안 쌓인다. */
function rng(seed: number) {
  let a = seed >>> 0;

  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Region = { name: string; lat: number; lng: number; weight: number };

const REGIONS: Region[] = [
  { name: '서울 강남구', lat: 37.5172, lng: 127.0473, weight: 6 },
  { name: '서울 서초구', lat: 37.4837, lng: 127.0324, weight: 4 },
  { name: '서울 송파구', lat: 37.5145, lng: 127.1059, weight: 3 },
  { name: '서울 마포구', lat: 37.5663, lng: 126.9014, weight: 3 },
  { name: '서울 용산구', lat: 37.5326, lng: 126.9905, weight: 2 },
  { name: '서울 영등포구', lat: 37.5264, lng: 126.8963, weight: 2 },
  { name: '서울 중구', lat: 37.5641, lng: 126.9979, weight: 2 },
  { name: '서울 종로구', lat: 37.5735, lng: 126.979, weight: 1 },
  { name: '서울 성동구', lat: 37.5634, lng: 127.0369, weight: 1 },
  { name: '서울 광진구', lat: 37.5385, lng: 127.0823, weight: 1 },
  { name: '경기 성남시', lat: 37.42, lng: 127.1265, weight: 3 },
  { name: '경기 수원시', lat: 37.2636, lng: 127.0286, weight: 3 },
  { name: '경기 고양시', lat: 37.6584, lng: 126.832, weight: 2 },
  { name: '경기 용인시', lat: 37.2411, lng: 127.1776, weight: 2 },
  { name: '경기 안양시', lat: 37.3943, lng: 126.9568, weight: 1 },
  { name: '인천 연수구', lat: 37.4102, lng: 126.6784, weight: 2 },
  { name: '인천 남동구', lat: 37.4474, lng: 126.7313, weight: 1 },
  { name: '부산 해운대구', lat: 35.1631, lng: 129.1636, weight: 2 },
  { name: '부산 부산진구', lat: 35.1631, lng: 129.0532, weight: 1 },
  { name: '대구 수성구', lat: 35.8582, lng: 128.6306, weight: 1 },
  { name: '대전 서구', lat: 36.3553, lng: 127.3838, weight: 1 },
  { name: '광주 서구', lat: 35.152, lng: 126.8902, weight: 1 },
];

type Recipe = {
  prefixes: string[];
  suffixes: string[];
  /** loremflickr 키워드. 쉼표로 AND. */
  keywords: string;
  /** 결제 금액 범위(원). */
  amount: [number, number];
};

const RECIPES: Record<SampleCategory, Recipe> = {
  hall: {
    prefixes: ['더채플', '라비돌', '아펠', '그랜드', '루체', '빌라드', '더컨벤션', '파티오', '헤리티지', '노블', '메종', '베르사유', '비체', '오네스타', '드마리스', '플로렌스', '라온', '아모리스', '루이비스', '엘리에나', '더링크', '세인트', '카이저', '더파티', '글로리', '보테가', '까사', '팔레스', '샤르망', '에벤에셀'],
    suffixes: ['웨딩홀', '컨벤션', '호텔웨딩', '채플', '가든', '스퀘어', '팰리스', '하우스'],
    keywords: 'wedding,hall,banquet',
    amount: [15_000_000, 45_000_000],
  },
  studio: {
    prefixes: ['별빛', '하늘', '모던', '블랑', '뮤즈', '아뜰리에', '리안', '라포레', '제이', '루나', '베르', '메이', '헤르츠', '오드', '샤이닝', '아르페', '이든', '유니크', '더블유', '클래식', '그레이스', '노아', '세컨드', '온더', '필름', '화이트', '라움', '테라스', '브릿지', '스토리'],
    suffixes: ['스튜디오', '포토', '픽처스', '아뜰리에', '스튜디오 본점'],
    keywords: 'wedding,studio,portrait',
    amount: [800_000, 2_500_000],
  },
  dress: {
    prefixes: ['하늘', '고운', '온유', '블랑', '뮤즈', '소예', '에스더', '피오니', '로즈', '클로에', '벨라', '메종', '라비', '오뜨', '샤넬', '루체', '아뜰리에', '비앙카', '엘리', '리사', '마리', '줄리', '세라', '앤', '까멜리아', '릴리', '비올라', '오르', '까사', '베일'],
    suffixes: ['드레스', '브라이덜', '드레스 살롱', '꾸뛰르', '웨딩드레스'],
    keywords: 'wedding,dress,bride',
    amount: [1_000_000, 3_000_000],
  },
  makeup: {
    prefixes: ['고운', '온유', '제니', '순수', '정샘', '김청경', '이경민', '뷰티', '라뷰', '아이', '메이', '바이', '올리브', '벨', '루엘', '비비', '리엔', '세라', '헤어', '클로', '샤', '유', '수', '진', '연', '윤', '민', '해', '담', '결'],
    suffixes: ['메이크업', '헤어메이크업', '살롱', '뷰티', '브라이덜 메이크업'],
    keywords: 'wedding,makeup,bride',
    amount: [500_000, 1_500_000],
  },
  snap: {
    prefixes: ['온', '필름', '데이', '모먼트', '기록', '봄날', '순간', '라이트', '포에', '아침', '둘', '오늘', '노을', '숲', '바다', '별', '달', '윤슬', '결', '틈', '여름', '가을', '겨울', '새벽', '해질녘', '밤', '햇살', '바람', '이야기', '너와'],
    suffixes: ['스냅', '영상', '필름', '포토', '스튜디오', '픽처스'],
    keywords: 'wedding,photography',
    amount: [800_000, 2_500_000],
  },
  goods: {
    prefixes: ['골든', '루미에르', '다이아', '브릴리언트', '로얄', '클래식', '에떼', '벨르', '아모르', '보석', '주얼', '티파', '펄', '오로', '샤인', '라뜰', '피네', '리츠', '로만', '실버', '한복', '규방', '예단', '진주', '금은', '옥', '수정', '온새미', '단아', '고운'],
    suffixes: ['주얼리', '예물', '예단', '한복', '골드', '컬렉션'],
    keywords: 'wedding,ring,jewelry',
    amount: [3_000_000, 15_000_000],
  },
  dowry: {
    prefixes: ['혼수', '신혼', '홈', '리빙', '하우스', '라이프', '스마트', '프리미엄', '베스트', '하이', '모던', '심플', '더', '온', '가온', '한샘', '까사', '리바트', '일룸', '에이스', '시몬스', '템퍼', '슬립', '코지', '웰빙', '그린', '클린', '에코', '퓨어', '데일리'],
    suffixes: ['가전', '가구', '침구', '혼수 백화점', '리빙', '홈퍼니싱'],
    keywords: 'home,appliance,furniture',
    amount: [3_000_000, 15_000_000],
  },
  honeymoon: {
    prefixes: ['블루', '오션', '허니', '아일랜드', '파라다이스', '트래블', '투어', '리조트', '선셋', '팜', '몰디브', '발리', '칸쿤', '하와이', '산토리니', '보라카이', '세부', '푸켓', '코타', '괌', '사이판', '타히티', '피지', '모리셔스', '두바이', '로마', '파리', '프라하', '스위스', '홋카이도'],
    suffixes: ['허니문', '트래블', '투어', '여행사', '홀리데이'],
    keywords: 'honeymoon,beach,resort',
    amount: [4_000_000, 12_000_000],
  },
  invitation: {
    prefixes: ['바른', '고운', '단아', '온', '소소', '담다', '봄', '꽃', '레터', '페이퍼', '카드', '캘리', '손글씨', '모던', '클래식', '심플', '더', '아트', '핸드', '프레스', '레트로', '빈티지', '화이트', '골드', '실버', '로즈', '민트', '블루', '라벤더', '아이보리'],
    suffixes: ['청첩장', '카드', '인비테이션', '페이퍼', '레터프레스'],
    keywords: 'wedding,invitation,card',
    amount: [50_000, 400_000],
  },
  wedding_info_company: {
    prefixes: ['듀오', '가연', '노블', '레드힐', '선우', '바로', '천생', '인연', '커플', '연리지', '결', '만남', '하나', '온리', '베스트', '프리미엄', '로얄', '엘리트', '퍼스트', '스마트', '행복', '좋은', '참', '진', '설렘', '두근', '정담', '연분', '동행', '평생'],
    suffixes: ['결혼정보', '매칭', '커플매니저', '결정사', '메리지'],
    keywords: 'couple,wedding',
    amount: [1_500_000, 6_000_000],
  },
};

const ACTIVE_USER = `INSERT INTO structured.users
     (display_name, age_gate, age_checked_at, age_verified, age_verified_at, activated_at)
   VALUES ($1, 'passed', now(), true, now(), now()) RETURNING id`;

function pickWeighted(random: () => number): Region {
  const total = REGIONS.reduce((sum, r) => sum + r.weight, 0);
  let roll = random() * total;

  for (const region of REGIONS) {
    roll -= region.weight;
    if (roll <= 0) return region;
  }

  return REGIONS[0]!;
}

type Reporter = { id: string; weddingId: string };

/** 제보자 40명 — 각자 웨딩 하나(계약 표본이 웨딩에 매달린다). 부를 이름 «제보자N». */
async function seedReporters(client: PoolClient): Promise<Reporter[]> {
  const reporters: Reporter[] = [];

  for (let n = 1; n <= REPORTER_COUNT; n += 1) {
    const existing = await client.query<{ id: string }>(
      `SELECT u.id FROM structured.users u
       WHERE u.display_name = $1 AND u.display_name_user_set = false
         AND NOT EXISTS (SELECT 1 FROM identity.identities i WHERE i.user_id = u.id)
       LIMIT 1`,
      [REPORTER_NAME(n)]
    );
    const id = existing.rows[0]?.id ?? (await client.query<{ id: string }>(ACTIVE_USER, [REPORTER_NAME(n)])).rows[0]!.id;
    const wedding = await client.query<{ id: string }>(
      `WITH existing AS (SELECT id FROM structured.weddings WHERE owner_user_id = $1 LIMIT 1),
            made AS (
              INSERT INTO structured.weddings (owner_user_id)
              SELECT $1 WHERE NOT EXISTS (SELECT 1 FROM existing)
              RETURNING id
            )
       SELECT id FROM existing UNION ALL SELECT id FROM made`,
      [id]
    );

    reporters.push({ id, weddingId: wedding.rows[0]!.id });
  }

  return reporters;
}

/** 계약 표본의 개인정보 검토자(pii_reviewed_by)가 필요하다. 로그인 수단이 없어 실제로는 못 들어온다. */
async function seedOperator(client: PoolClient): Promise<string> {
  const existing = await client.query<{ id: string }>(
    `SELECT u.id FROM structured.users u
     WHERE u.display_name = $1 AND u.display_name_user_set = false
       AND NOT EXISTS (SELECT 1 FROM identity.identities i WHERE i.user_id = u.id)
     LIMIT 1`,
    [OPERATOR_NAME]
  );

  if (existing.rows[0]) return existing.rows[0].id;

  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO structured.users
       (display_name, is_operator, age_gate, age_checked_at, age_verified, age_verified_at, activated_at)
     VALUES ($1, true, 'passed', now(), true, now(), now()) RETURNING id`,
    [OPERATOR_NAME]
  );

  return rows[0]!.id;
}

type Proof = { amount: number; daysAgo: number; reporter: number };

type ReviewDraft = {
  reporter: number;
  /** Pick 인증 후기(결제인증 근거)인가, 상담 제보인가. */
  verified: boolean;
  role: 'contractor' | 'couple';
  overall: number;
  title: string;
  body: string;
  daysAgo: number;
  aspects: { key: string; rating: number }[];
  checklist: { item: string; answer: 'yes' | 'no' }[];
};

type Sample = {
  key: string;
  name: string;
  region: Region;
  lat: number;
  lng: number;
  address: string;
  lock: number;
  proofs: Proof[];
  reviews: ReviewDraft[];
  /** 업체 안내 — 같은 상품의 확인된 계약. 5건부터 기준금액이 생긴다. */
  contracts: { reporter: number; amount: number; daysAgo: number }[];
};

/** 후기 문장 — 업종마다 8개. 50자 넘어야 한다(reviews.body CHECK). */
const REVIEW_TEXTS: Record<SampleCategory, { title: string; body: string }[]> = {
  hall: [
    { title: '식사 반응이 좋았어요', body: '하객분들이 식사 맛과 온도를 제일 많이 칭찬했어요. 뷔페 동선도 넓어서 붐비는 느낌이 덜했고 직원분들이 자리 안내를 꼼꼼히 해주셨어요.' },
    { title: '주차 안내가 잘 돼 있어요', body: '주차장 입구부터 안내 요원이 있어서 하객들이 헤매지 않았어요. 홀 조명이 사진에 예쁘게 나오고 신부 대기실도 넓어서 편했어요.' },
    { title: '추가 비용 안내가 명확했어요', body: '계약 전에 별도로 드는 비용을 표로 정리해 주셔서 당일에 놀랄 일이 없었어요. 보증 인원 조정도 유연하게 받아주셨어요.' },
    { title: '동선이 편했어요', body: '식장과 연회장이 같은 층이라 어르신들이 이동하기 편했어요. 식사 시간이 예식과 겹치지 않게 진행해 주신 점이 좋았어요.' },
    { title: '조명과 음향이 좋았어요', body: '버진로드 조명이 예쁘고 음향이 또렷해서 축가가 잘 들렸어요. 홀 매니저가 리허설 때 세세하게 챙겨 주셔서 당일이 수월했어요.' },
    { title: '식사 대기가 조금 있었어요', body: '예식이 몰리는 시간대라 뷔페 줄이 길었어요. 그래도 음식 보충이 빨랐고 주차 안내와 직원 응대는 만족스러웠어요.' },
    { title: '하객 응대가 친절했어요', body: '안내 데스크와 홀 직원분들이 하객 한 분 한 분 안내를 잘해 주셨어요. 대중교통으로 오기 편한 위치라 멀리서 오신 분들도 좋아하셨어요.' },
    { title: '전체적으로 만족했어요', body: '상담부터 예식 당일까지 담당자가 바뀌지 않아서 이야기가 잘 이어졌어요. 식사와 주차 모두 무난했고 추가 비용도 처음 안내와 같았어요.' },
  ],
  studio: [
    { title: '보정 결과가 자연스러워요', body: '원본 셀렉 후 보정본이 과하지 않고 자연스러웠어요. 촬영 당일 실장님이 포즈를 계속 잡아 주셔서 어색하지 않게 찍을 수 있었어요.' },
    { title: '촬영 시간이 여유로웠어요', body: '촬영 팀이 서두르지 않아서 원하는 컷을 충분히 찍었어요. 결과물 전달도 약속한 날짜에 맞춰 왔어요. 준비 과정에서 물어본 것마다 답이 빨라서 마음이 놓였어요.' },
    { title: '요청 사항 반영이 빨라요', body: '촬영 컨셉과 소품 요청을 미리 전달했더니 당일 그대로 준비돼 있었어요. 추가 비용도 사전에 안내받은 대로였어요.' },
    { title: '보정 수정 요청이 편했어요', body: '보정본 수정 요청을 두 번 했는데 모두 빠르게 반영해 주셨어요. 원본 컷 수도 넉넉해서 고르는 재미가 있었어요.' },
    { title: '세트 구성이 다양해요', body: '실내 세트가 여러 컨셉이라 한 번 촬영으로 분위기가 다른 사진을 여럿 얻었어요. 야외 촬영도 이동이 짧아서 지치지 않았어요.' },
    { title: '원본을 전부 받았어요', body: '원본 컷을 전부 전달해 주셔서 고르는 폭이 넓었어요. 액자와 앨범 추가 비용은 계약 전에 표로 안내받은 그대로였어요.' },
    { title: '조명이 잘 맞았어요', body: '스튜디오 조명이 피부 톤에 잘 맞아서 보정 전 원본도 마음에 들었어요. 실장님이 표정 지도를 세세하게 해 주셨어요.' },
    { title: '무난하게 만족했어요', body: '전체적으로 무난했고 큰 아쉬움은 없었어요. 앨범 제작 기간이 조금 길었지만 안내받은 일정 안에는 들어왔어요.' },
  ],
  dress: [
    { title: '피팅 상태가 좋았어요', body: '드레스 상태가 새것처럼 깨끗했고 피팅 때 요청한 부분을 바로 반영해 주셨어요. 헬퍼 이모님도 촬영 내내 세심하게 챙겨 주셨어요.' },
    { title: '드레스 종류가 많아요', body: '피팅 때 고를 수 있는 드레스가 다양했고 실장님 추천이 잘 맞았어요. 체형에 맞는 라인을 먼저 골라 주셔서 시간이 절약됐어요.' },
    { title: '수선이 꼼꼼했어요', body: '허리와 기장 수선을 촬영 전에 두 번 봐 주셨어요. 본식 드레스도 같은 실장님이 맡아 주셔서 이야기가 잘 이어졌어요.' },
    { title: '추가 비용 안내가 명확했어요', body: '피팅비와 헬퍼비, 드레스 업그레이드 비용을 계약 전에 표로 정리해 주셔서 당일에 놀랄 일이 없었어요. 응대도 친절했어요.' },
    { title: '요청 사항 반영이 빨라요', body: '원하는 실루엣 사진을 보내드렸더니 비슷한 드레스를 미리 준비해 두셨어요. 피팅 시간이 짧았는데도 결정이 편했어요.' },
    { title: '피팅 시간이 넉넉했어요', body: '한 벌당 입어보는 시간을 충분히 주셔서 서두르지 않고 골랐어요. 촬영 드레스와 본식 드레스를 같이 정리해 주신 점도 좋았어요.' },
    { title: '소품 구성이 좋았어요', body: '베일과 티아라, 장갑까지 드레스에 맞춰 같이 골라 주셨어요. 소품 대여 비용도 처음 안내와 같았어요. 준비 과정이 편했어요.' },
    { title: '무난했어요', body: '드레스 품질과 응대 모두 무난했어요. 피팅 예약이 조금 어려웠지만 한 번 잡히면 진행은 매끄러웠어요. 큰 아쉬움은 없어요.' },
  ],
  makeup: [
    { title: '메이크업이 오래 갔어요', body: '이른 아침 메이크업이었는데 저녁까지 잘 유지됐어요. 촬영 스튜디오 조명과 잘 맞는 톤으로 잡아 주셨어요.' },
    { title: '헤어가 하루 종일 흐트러지지 않았어요', body: '본식 내내 헤어가 그대로였어요. 피로연 때 스타일을 바꿔 주신 것도 추가 비용 없이 처음 안내 그대로였어요.' },
    { title: '원하는 분위기를 잘 잡아 주셨어요', body: '참고 사진을 보내드렸더니 얼굴형에 맞게 조정해서 비슷한 분위기를 만들어 주셨어요. 리허설 때 수정 요청도 바로 반영됐어요.' },
    { title: '피부 표현이 자연스러워요', body: '두껍지 않은데도 사진에 잘 나왔어요. 신랑 메이크업까지 같은 팀이 맡아서 톤이 맞았어요. 준비 과정에서 물어본 것마다 답이 빨랐어요.' },
    { title: '시간 약속이 정확했어요', body: '새벽 예약이었는데 시간에 맞춰 시작했고 예식장 도착 시간도 여유 있었어요. 어머님 메이크업 비용도 미리 안내받았어요.' },
    { title: '리허설이 도움이 됐어요', body: '리허설 메이크업 때 두 가지 톤을 비교해 보고 본식 스타일을 정했어요. 당일 실장님이 바뀌지 않아서 안심이 됐어요.' },
    { title: '추가 비용이 없었어요', body: '헤어 장식과 속눈썹 비용까지 계약 때 안내받은 금액 그대로였어요. 응대가 친절하고 대기 공간도 편했어요. 큰 아쉬움은 없어요.' },
    { title: '무난했어요', body: '시술과 응대 모두 무난했어요. 대기 시간이 조금 있었지만 진행 자체는 매끄러웠어요. 준비 과정에서 물어본 것마다 답이 빨라서 마음이 놓였어요.' },
  ],
  snap: [
    { title: '순간을 잘 잡아 주셨어요', body: '본식 중 부모님 표정이나 하객 반응처럼 놓치기 쉬운 순간을 잘 담아 주셨어요. 원본 전달도 빨랐어요.' },
    { title: '영상 편집이 깔끔해요', body: '하이라이트 영상 편집이 담백해서 여러 번 봐도 질리지 않아요. 음악 선곡도 미리 상의해 주셨어요.' },
    { title: '작가님이 편하게 해주셨어요', body: '촬영 내내 자연스럽게 움직이라고 안내해 주셔서 사진이 어색하지 않아요. 하객 단체 사진도 빠르게 정리해 주셨어요.' },
    { title: '전달이 약속대로 왔어요', body: '보정본과 영상이 안내받은 일정에 맞춰 도착했어요. 요청한 추가 컷도 함께 보내 주셨어요. 준비 과정에서 물어본 것마다 답이 빨라서 마음이 놓였어요.' },
    { title: '두 작가 구성이 좋았어요', body: '신랑 신부 양쪽을 두 작가가 나눠 찍어 주셔서 준비 과정까지 다 담겼어요. 색감이 따뜻해서 마음에 들어요.' },
    { title: '색감이 마음에 들어요', body: '샘플로 본 색감 그대로 결과물이 나왔어요. 야외 촬영에서도 노출이 안정적이었어요. 준비 과정에서 물어본 것마다 답이 빨라서 마음이 놓였어요.' },
    { title: '원본 컷이 넉넉했어요', body: '원본을 전부 전달해 주셔서 고르는 폭이 넓었어요. 소통이 빠르고 요청 사항도 잘 기억해 주셨어요.' },
    { title: '무난하게 만족했어요', body: '전체적으로 무난했고 큰 아쉬움은 없었어요. 하이라이트 영상 길이를 조금 더 길게 요청할 수 있으면 좋겠어요.' },
  ],
  goods: [
    { title: '세공이 깔끔해요', body: '반지 세공 마감이 깔끔하고 착용감이 편해요. 사이즈 조정도 무료로 해주셨고 보증서까지 잘 챙겨 주셨어요.' },
    { title: '상담이 부담 없었어요', body: '예산을 먼저 말씀드리니 그 안에서만 추천해 주셔서 부담이 없었어요. 예단 구성도 필요한 것만 골라 주셨어요.' },
    { title: '디자인 선택지가 많아요', body: '샘플이 많아서 비교하며 고를 수 있었어요. 제작 기간도 안내받은 대로 맞춰 주셨어요. 준비 과정에서 물어본 것마다 답이 빨라서 마음이 놓였어요.' },
    { title: '사후 관리가 든든해요', body: '착용 후 세척과 점검을 무료로 받았어요. 상담해 주신 분이 계속 담당해 주셔서 편했어요. 준비 과정에서 물어본 것마다 답이 빨라서 마음이 놓였어요.' },
    { title: '가격 설명이 투명했어요', body: '금 시세와 공임을 따로 설명해 주셔서 왜 이 가격인지 이해가 됐어요. 할인 조건도 미리 알려 주셨어요.' },
    { title: '한복 맞춤이 만족스러워요', body: '치수 재는 과정이 꼼꼼했고 완성본 핏이 잘 맞았어요. 색상 상담도 사진을 보며 도와주셨어요.' },
    { title: '포장이 정성스러웠어요', body: '예단 포장이 정성스러워서 양가 어른들 반응이 좋았어요. 배송 일정도 정확했어요. 준비 과정에서 물어본 것마다 답이 빨라서 마음이 놓였어요.' },
    { title: '무난했어요', body: '품질과 가격 모두 무난했어요. 매장 방문 예약이 조금 어려웠지만 상담 자체는 친절했어요. 준비 과정에서 물어본 것마다 답이 빨라서 마음이 놓였어요.' },
  ],
  dowry: [
    { title: '배송과 설치가 정확했어요', body: '입주일에 맞춰 가전과 가구가 한 번에 들어왔고 설치 기사님이 자리까지 잡아 주셨어요. 포장 회수도 같이 해 주셨어요.' },
    { title: '구성 상담이 부담 없었어요', body: '예산을 먼저 말씀드리니 그 안에서 필요한 것만 골라 주셨어요. 브랜드를 섞어도 할인 조건이 같았어요. 준비 과정이 편했어요.' },
    { title: '품질이 기대 이상이에요', body: '침구와 소파 마감이 매장에서 본 것과 같았어요. 사용 한 달 지났는데 문제가 없어요. 사후 문의도 빠르게 답해 주셨어요.' },
    { title: '가격 설명이 투명했어요', body: '제품별 가격과 혼수 할인 조건을 따로 설명해 주셔서 왜 이 가격인지 이해가 됐어요. 카드 혜택도 미리 알려 주셨어요.' },
    { title: '일정 조율이 편했어요', body: '집 공사 일정이 밀렸는데 배송일을 추가 비용 없이 바꿔 주셨어요. 담당자가 끝까지 같은 분이라 이야기가 잘 이어졌어요.' },
    { title: '설치 후 점검이 든든해요', body: '설치 일주일 뒤에 이상 없는지 먼저 연락해 주셨어요. 냉장고 문 방향 변경도 무료로 해 주셨어요. 준비 과정이 편했어요.' },
    { title: '추가 비용이 없었어요', body: '배송비와 설치비가 견적에 다 들어 있어서 당일 따로 낸 돈이 없어요. 폐가전 수거까지 같이 해 주셨어요. 응대가 친절했어요.' },
    { title: '무난했어요', body: '품질과 가격 모두 무난했어요. 매장 방문 예약이 조금 어려웠지만 상담 자체는 친절했어요. 준비 과정에서 물어본 것마다 답이 빨랐어요.' },
  ],
  honeymoon: [
    { title: '일정 조율이 편했어요', body: '항공과 숙소를 한 번에 잡아 주시고 일정표를 미리 보내 주셔서 준비가 편했어요. 현지 연락도 잘 됐어요.' },
    { title: '숙소 추천이 좋았어요', body: '예산 안에서 추천해 주신 숙소가 사진보다 좋았어요. 조식과 픽업까지 포함돼 있어서 편했어요.' },
    { title: '취소 규정을 미리 알려 줬어요', body: '예약 전에 취소와 변경 조건을 표로 정리해 주셔서 안심하고 결제했어요. 담당자 응답이 빨랐어요.' },
    { title: '현지 지원이 든든했어요', body: '현지에서 문제가 생겼을 때 담당자가 바로 대응해 주셨어요. 일정 변경도 추가 비용 없이 처리됐어요.' },
    { title: '가격이 합리적이었어요', body: '같은 조건을 여러 곳에서 비교했는데 여기가 가장 합리적이었어요. 포함 내역이 명확했어요. 준비 과정에서 물어본 것마다 답이 빨라서 마음이 놓였어요.' },
    { title: '세심한 안내가 좋았어요', body: '출발 전 준비물과 현지 팁을 정리해 주셔서 도움이 됐어요. 공항 픽업 시간도 정확했어요. 준비 과정에서 물어본 것마다 답이 빨라서 마음이 놓였어요.' },
    { title: '패키지 구성이 알찼어요', body: '투어와 자유 일정이 적절히 섞여 있어서 지루하지 않았어요. 식사 옵션도 미리 선택할 수 있었어요.' },
    { title: '무난했어요', body: '큰 문제 없이 다녀왔어요. 항공 좌석 지정은 직접 해야 했지만 나머지는 잘 챙겨 주셨어요.' },
  ],
  invitation: [
    { title: '인쇄 품질이 만족스러워요', body: '종이 질감과 인쇄 색감이 화면으로 본 시안 그대로였어요. 봉투와 스티커까지 세트로 맞춰 주셔서 따로 고를 일이 없었어요.' },
    { title: '시안 수정이 빨랐어요', body: '문구와 배치 수정을 세 번 요청했는데 매번 하루 안에 새 시안이 왔어요. 모바일 청첩장도 같은 디자인으로 맞춰 주셨어요.' },
    { title: '제작 기간이 정확했어요', body: '안내받은 제작 기간 안에 도착했고 포장 상태도 깔끔했어요. 추가 인쇄도 같은 단가로 빠르게 처리해 주셨어요.' },
    { title: '디자인 선택지가 많아요', body: '샘플이 많아서 비교하며 고를 수 있었어요. 샘플 청첩장을 먼저 받아 종이를 만져보고 결정할 수 있어서 좋았어요.' },
    { title: '요청 사항 반영이 좋았어요', body: '양가 이름 표기 순서와 계좌 안내 문구를 원하는 대로 넣어 주셨어요. 오탈자 검수도 두 번 해 주셔서 안심이 됐어요.' },
    { title: '가격이 합리적이었어요', body: '비슷한 디자인을 여러 곳에서 비교했는데 구성 대비 가격이 합리적이었어요. 봉투 인쇄와 배송비가 포함이라 계산이 편했어요.' },
    { title: '모바일 청첩장까지 편했어요', body: '종이 청첩장과 모바일 청첩장을 한 번에 맡겼는데 사진 배치와 지도 안내가 깔끔했어요. 수정 요청도 바로 반영됐어요.' },
    { title: '무난했어요', body: '큰 아쉬움 없이 무난했어요. 성수기라 제작 기간이 조금 길었지만 안내받은 일정 안에는 들어왔어요. 응대가 친절했어요.' },
  ],
  wedding_info_company: [
    { title: '설명이 솔직했어요', body: '회원권 가격과 만남 횟수를 처음부터 정확히 설명해 주셨어요. 계약서 내용과 상담 내용이 같았어요.' },
    { title: '매칭이 약속대로였어요', body: '계약 때 안내받은 횟수만큼 만남이 진행됐어요. 매니저가 취향을 잘 파악해 주셨어요. 준비 과정에서 물어본 것마다 답이 빨라서 마음이 놓였어요.' },
    { title: '강요가 없었어요', body: '상담 때 바로 결정하라고 재촉하지 않아서 편했어요. 며칠 생각한 뒤 연락드렸는데 조건이 그대로였어요.' },
    { title: '담당 매니저가 꾸준했어요', body: '담당자가 바뀌지 않고 끝까지 연락해 주셨어요. 만남 후 피드백도 자세히 전달해 주셨어요. 준비 과정에서 물어본 것마다 답이 빨라서 마음이 놓였어요.' },
    { title: '환불 규정이 명확했어요', body: '중도 해지 시 환불 기준을 계약 전에 문서로 받았어요. 실제로 문의했을 때도 같은 기준으로 안내받았어요.' },
    { title: '만남 주기가 일정했어요', body: '한 달에 안내받은 횟수대로 만남이 잡혔어요. 프로필 관리도 세심했어요. 준비 과정에서 물어본 것마다 답이 빨라서 마음이 놓였어요.' },
    { title: '조건 설명이 명확했어요', body: '추가 비용이 생기는 경우를 미리 알려 주셔서 예상 밖 지출이 없었어요. 상담 분위기도 편안했어요.' },
    { title: '무난했어요', body: '전체적으로 안내받은 대로 진행됐어요. 첫 상담 시간이 길었지만 그만큼 설명이 충분했어요. 준비 과정에서 물어본 것마다 답이 빨라서 마음이 놓였어요.' },
  ],
};

/** 업체 안내에 보일 상품 이름 — 업종당 하나. */
const PRODUCT_NAME: Record<SampleCategory, string> = {
  wedding_info_company: '기본 회원권',
  hall: '그랜드홀 대관 + 식대',
  studio: '스튜디오 촬영 기본',
  dress: '드레스 대여 + 피팅',
  makeup: '신부 메이크업 + 헤어',
  snap: '본식 스냅 기본',
  goods: '예물 반지 세트',
  dowry: '혼수 가전 기본 세트',
  honeymoon: '허니문 패키지',
  invitation: '청첩장 100매 기본',
};

/** 0~2 · 3~4 · 5~9 · 10+ — 네 단계가 다 보이되, 상세가 채워진 곳이 많게. */
function proofCount(random: () => number): number {
  const roll = random();

  if (roll < 0.1) return Math.floor(random() * 3);
  if (roll < 0.25) return 3 + Math.floor(random() * 2);
  if (roll < 0.6) return 5 + Math.floor(random() * 5);

  return 10 + Math.floor(random() * 7);
}

/** 절반은 최근 3개월 안 — 조건별 사례(/conditions)가 좁힌 조건에서도 열리게. */
function proofDaysAgo(random: () => number): number {
  return random() < 0.5 ? 5 + Math.floor(random() * 80) : 90 + Math.floor(random() * 250);
}

function slug(category: string, index: number): string {
  return `${category}-${String(index + 1).padStart(3, '0')}`;
}

/**
 * 업종 하나의 표본을 **먼저 전부 뽑는다.** 난수를 DB 결과와 무관하게 같은
 * 순서로 쓰기 위해서다 — 이미 있는 업체를 건너뛰면서 난수를 덜 쓰면 그 뒤의
 * 이름이 전부 달라져 두 번째 실행이 새 업체를 또 만든다(처음에 그랬다).
 */
function drawSamples(category: SampleCategory): Sample[] {
  const recipe = RECIPES[category];
  const random = rng(category.split('').reduce((h, c) => h * 31 + c.charCodeAt(0), 7));
  const used = new Set<string>();
  const samples: Sample[] = [];
  const aspects = aspectsFor(category);
  const checklist = checklistFor(category);
  const texts = REVIEW_TEXTS[category];

  for (let index = 0; index < PER_CATEGORY; index += 1) {
    let name = '';
    let region = REGIONS[0]!;

    for (let attempt = 0; attempt < 50; attempt += 1) {
      const prefix = recipe.prefixes[Math.floor(random() * recipe.prefixes.length)]!;
      const suffix = recipe.suffixes[Math.floor(random() * recipe.suffixes.length)]!;

      region = pickWeighted(random);
      name = `${prefix}${suffix}`;

      if (!used.has(`${name}|${region.name}`)) break;
    }

    used.add(`${name}|${region.name}`);

    const lat = region.lat + (random() - 0.5) * 0.04;
    const lng = region.lng + (random() - 0.5) * 0.05;
    const count = proofCount(random);
    const [low, high] = recipe.amount;
    const proofs: Proof[] = [];

    /* 제보자는 index*7+n — 한 업체 안에서는 겹치지 않는다(n < 40). */
    for (let n = 0; n < count; n += 1) {
      proofs.push({
        amount: Math.round((low + random() * (high - low)) / 10_000) * 10_000,
        daysAgo: proofDaysAgo(random),
        reporter: (index * 7 + n) % REPORTER_COUNT,
      });
    }

    /*
     * 후기 — 결제인증이 5건 넘으면 Pick 인증 후기 6개(점수가 생기는 최소 5개 초과)
     * + 상담 제보 2개. 3~4건이면 인증 2개 + 제보 1개, 그 아래는 제보 1개.
     * 인증 후기의 작성자는 그 업체에 결제인증을 낸 제보자다(근거 FK).
     */
    const verifiedCount = count >= 5 ? Math.min(6, count) : count >= 3 ? 2 : 0;
    const reportedCount = count >= 5 ? 2 : 1;
    const reviews: ReviewDraft[] = [];
    const draftReview = (reporter: number, verified: boolean, seq: number): ReviewDraft => {
      const text = texts[(index + seq) % texts.length]!;
      const overallRoll = random();
      const overall = overallRoll < 0.15 ? 3 : overallRoll < 0.55 ? 4 : 5;

      return {
        reporter,
        verified,
        role: seq % 3 === 0 ? 'couple' : 'contractor',
        overall,
        title: text.title,
        body: text.body,
        daysAgo: 3 + Math.floor(random() * 300),
        aspects:
          checklist.length > 0
            ? []
            : aspects.map((aspect) => ({
                key: aspect.key,
                rating:
                  aspect.key === 'extra_cost'
                    ? 2 + Math.floor(random() * 3)
                    : Math.max(1, Math.min(5, overall - 1 + Math.floor(random() * 3))),
              })),
        checklist: checklist.map((item) => {
          const good = random() < 0.8;

          return { item: item.key, answer: good === item.yesIsGood ? 'yes' : 'no' };
        }),
      };
    };

    for (let n = 0; n < verifiedCount; n += 1) reviews.push(draftReview(proofs[n]!.reporter, true, n));
    for (let n = 0; n < reportedCount; n += 1) {
      reviews.push(draftReview((index * 7 + count + n) % REPORTER_COUNT, false, verifiedCount + n));
    }

    /* 업체 안내 — 확인된 계약. 5건부터 기준금액, 그 아래는 «모였지만 모자라요». */
    const contractCount = count >= 5 ? 6 : count >= 3 ? 4 : 0;
    const base = (low + high) / 2;
    const contracts: Sample['contracts'] = [];

    for (let n = 0; n < contractCount; n += 1) {
      contracts.push({
        reporter: (index * 7 + n) % REPORTER_COUNT,
        amount: Math.round((base + (n - Math.floor(contractCount / 2)) * base * 0.06) / 10_000) * 10_000,
        daysAgo: 30 + n * 23,
      });
    }

    samples.push({
      key: slug(category, index),
      name,
      region,
      lat,
      lng,
      address: `${region.name} 샘플로 ${10 + index * 3}`,
      lock: 1000 + SAMPLE_CATEGORIES.indexOf(category) * PER_CATEGORY + index,
      proofs,
      reviews,
      contracts,
    });
  }

  return samples;
}

async function seedCategory(
  client: PoolClient,
  category: SampleCategory,
  reporters: Reporter[],
  operatorId: string
) {
  const recipe = RECIPES[category];
  const samples = drawSamples(category);

  /*
   * 한 업종을 질의 몇 번으로 넣는다(업체 · 출처 표시 · 이미지 · 결제인증 · 후기 ·
   * 항목 평가 · 계약). 한 행씩 넣으면 원격 DB에서 20분 제한을 넘겼다(run 1).
   * UNNEST로 배열을 행으로 펼쳐 한 번에 넣고, 유일 제약에 걸린 업체는
   * RETURNING에 안 나오므로 그 뒤 것들도 자연히 빠진다.
   *
   * source는 public_data — 상세의 «공공기관 확인» 배지와 공식 정보 블록이 이
   * 값으로 켜진다. 샘플이라는 표시는 vendor_source_records(sample)가 맡는다.
   */
  const { rows } = await client.query<{ id: string; name: string; region: string }>(
    `INSERT INTO structured.vendors (category, name, region, source, lat, lng, address, collection_status)
     SELECT $1::vendor_category, name, region, 'public_data', lat, lng, address, 'operating'
     FROM UNNEST($2::text[], $3::text[], $4::float8[], $5::float8[], $6::text[]) AS t(name, region, lat, lng, address)
     ON CONFLICT (normalized_name, region) DO NOTHING
     RETURNING id, name, region`,
    [
      category,
      samples.map((sample) => sample.name),
      samples.map((sample) => sample.region.name),
      samples.map((sample) => sample.lat),
      samples.map((sample) => sample.lng),
      samples.map((sample) => sample.address),
    ]
  );

  const idOf = new Map(rows.map((row) => [`${row.name}|${row.region}`, row.id]));
  const inserted = samples.filter((sample) => idOf.has(`${sample.name}|${sample.region.name}`));
  const skipped = samples.length - inserted.length;

  if (inserted.length === 0) return { inserted: 0, skipped };

  const vendorId = (sample: Sample) => idOf.get(`${sample.name}|${sample.region.name}`)!;

  await client.query(
    `INSERT INTO structured.vendor_source_records
       (source_key, record_key, vendor_id, source_url, collected_at, content_hash)
     SELECT $1, key, vendor_id::uuid, 'sample://weddingpick/' || key, now(), 'sample'
     FROM UNNEST($2::text[], $3::text[]) AS t(key, vendor_id)
     ON CONFLICT (source_key, record_key) DO NOTHING`,
    [SOURCE_KEY, inserted.map((sample) => sample.key), inserted.map(vendorId)]
  );

  /* 사진 3장씩 — 첫 장이 대표. lock 값이 같으면 같은 사진이 돌아온다. */
  const images = inserted.flatMap((sample) =>
    [0, 1, 2].map((n) => ({
      vendorId: vendorId(sample),
      url: `https://loremflickr.com/800/500/${recipe.keywords}?lock=${sample.lock + n * 10_000}`,
      representative: n === 0,
    }))
  );

  await client.query(
    `INSERT INTO structured.vendor_images
       (vendor_id, source_url, copyright_basis, copyright_note, match_confidence,
        width_px, height_px, status, is_representative, verified_at)
     SELECT vendor_id::uuid, url, 'cc_by', $4, 0, 800, 500, 'approved', representative, now()
     FROM UNNEST($1::text[], $2::text[], $3::boolean[]) AS t(vendor_id, url, representative)`,
    [
      images.map((image) => image.vendorId),
      images.map((image) => image.url),
      images.map((image) => image.representative),
      '샘플 이미지 · Flickr CC BY(loremflickr). 실제 업체 사진이 아니다.',
    ]
  );

  /* 실 제보 — 최근 12개월 안의 결제인증. 후기의 근거가 되므로 id를 받아둔다. */
  const proofs = inserted.flatMap((sample) =>
    sample.proofs.map((proof) => ({
      reporter: reporters[proof.reporter]!.id,
      vendorId: vendorId(sample),
      merchant: sample.name,
      amount: proof.amount,
      daysAgo: proof.daysAgo,
    }))
  );
  const proofIdOf = new Map<string, string>();

  if (proofs.length > 0) {
    const insertedProofs = await client.query<{ id: string; vendor_id: string; reporter_user_id: string }>(
      `INSERT INTO structured.payment_proofs
         (reporter_user_id, vendor_id, merchant_name, paid_amount, paid_at, method, analyzed_at)
       SELECT reporter::uuid, vendor_id::uuid, merchant, amount, now() - (days || ' days')::interval, 'card', now()
       FROM UNNEST($1::text[], $2::text[], $3::text[], $4::bigint[], $5::text[])
         AS t(reporter, vendor_id, merchant, amount, days)
       ON CONFLICT DO NOTHING
       RETURNING id, vendor_id, reporter_user_id`,
      [
        proofs.map((proof) => proof.reporter),
        proofs.map((proof) => proof.vendorId),
        proofs.map((proof) => proof.merchant),
        proofs.map((proof) => proof.amount),
        proofs.map((proof) => String(proof.daysAgo)),
      ]
    );

    for (const row of insertedProofs.rows) {
      if (!proofIdOf.has(`${row.vendor_id}|${row.reporter_user_id}`)) {
        proofIdOf.set(`${row.vendor_id}|${row.reporter_user_id}`, row.id);
      }
    }
  }

  /* 후기 — Pick 인증 후기는 그 제보자의 결제인증을 근거로 건다(verification_names_its_evidence). */
  const reviews = inserted.flatMap((sample) =>
    sample.reviews
      .map((draft) => ({
        draft,
        vendorId: vendorId(sample),
        author: reporters[draft.reporter]!.id,
        proofId: draft.verified ? proofIdOf.get(`${vendorId(sample)}|${reporters[draft.reporter]!.id}`) ?? null : null,
      }))
      .filter((review) => !review.draft.verified || review.proofId !== null)
  );

  if (reviews.length > 0) {
    const insertedReviews = await client.query<{ id: string; vendor_id: string; author_user_id: string }>(
      `INSERT INTO structured.reviews
         (vendor_id, author_user_id, role, overall, title, body, verification,
          verified_payment_proof_id, verified_at, status, created_at)
       SELECT vendor_id::uuid, author::uuid, role::reviewer_role, overall, title, body,
              CASE WHEN proof_id IS NULL THEN 'reported' ELSE 'payment' END::review_verification,
              proof_id::uuid,
              CASE WHEN proof_id IS NULL THEN NULL ELSE now() - (days || ' days')::interval END,
              'published', now() - (days || ' days')::interval
       FROM UNNEST($1::text[], $2::text[], $3::text[], $4::int[], $5::text[], $6::text[], $7::text[], $8::text[])
         AS t(vendor_id, author, role, overall, title, body, proof_id, days)
       ON CONFLICT (vendor_id, author_user_id) DO NOTHING
       RETURNING id, vendor_id, author_user_id`,
      [
        reviews.map((review) => review.vendorId),
        reviews.map((review) => review.author),
        reviews.map((review) => review.draft.role),
        reviews.map((review) => review.draft.overall),
        reviews.map((review) => review.draft.title),
        reviews.map((review) => review.draft.body),
        reviews.map((review) => review.proofId),
        reviews.map((review) => String(review.draft.daysAgo)),
      ]
    );
    const reviewIdOf = new Map(
      insertedReviews.rows.map((row) => [`${row.vendor_id}|${row.author_user_id}`, row.id])
    );

    /* 항목 평가(웨딩홀·스튜디오·드레스·메이크업·본식스냅·혼수·청첩장) 또는 체크리스트(결정사) — 한 후기에 둘 중 하나만(DB 트리거). */
    const aspectRows = reviews.flatMap((review) => {
      const reviewId = reviewIdOf.get(`${review.vendorId}|${review.author}`);

      return reviewId ? review.draft.aspects.map((aspect) => ({ reviewId, ...aspect })) : [];
    });

    if (aspectRows.length > 0) {
      await client.query(
        `INSERT INTO structured.review_aspects (review_id, aspect, rating)
         SELECT review_id::uuid, aspect, rating
         FROM UNNEST($1::text[], $2::text[], $3::int[]) AS t(review_id, aspect, rating)
         ON CONFLICT DO NOTHING`,
        [aspectRows.map((row) => row.reviewId), aspectRows.map((row) => row.key), aspectRows.map((row) => row.rating)]
      );
    }

    const checklistRows = reviews.flatMap((review) => {
      const reviewId = reviewIdOf.get(`${review.vendorId}|${review.author}`);

      return reviewId ? review.draft.checklist.map((entry) => ({ reviewId, ...entry })) : [];
    });

    if (checklistRows.length > 0) {
      await client.query(
        `INSERT INTO structured.review_checklist_answers (review_id, item, answer)
         SELECT review_id::uuid, item, answer::checklist_answer
         FROM UNNEST($1::text[], $2::text[], $3::text[]) AS t(review_id, item, answer)
         ON CONFLICT DO NOTHING`,
        [
          checklistRows.map((row) => row.reviewId),
          checklistRows.map((row) => row.item),
          checklistRows.map((row) => row.answer),
        ]
      );
    }
  }

  /* 업체 안내 — 같은 상품의 확인된 계약(L2 · 확정 · 개인정보 검토 끝). */
  const contracts = inserted.flatMap((sample) =>
    sample.contracts.map((contract) => ({
      weddingId: reporters[contract.reporter]!.weddingId,
      vendorId: vendorId(sample),
      productName: PRODUCT_NAME[category],
      productKey: productKey({ vendorId: vendorId(sample), productName: PRODUCT_NAME[category] }),
      amount: contract.amount,
      daysAgo: contract.daysAgo,
    }))
  );

  if (contracts.length > 0) {
    await client.query(
      `INSERT INTO structured.quotes
         (wedding_id, vendor_id, doc_type, product_name, product_key, total_amount,
          contract_date, verification_level, source, confirmed_at,
          pii_review, pii_reviewed_at, pii_reviewed_by)
       SELECT wedding_id::uuid, vendor_id::uuid, 'contract', product_name, product_key, amount,
              (now() - (days || ' days')::interval)::date, 'L2', 'contract_verified', now(),
              'clean', now(), $7::uuid
       FROM UNNEST($1::text[], $2::text[], $3::text[], $4::text[], $5::bigint[], $6::text[])
         AS t(wedding_id, vendor_id, product_name, product_key, amount, days)`,
      [
        contracts.map((contract) => contract.weddingId),
        contracts.map((contract) => contract.vendorId),
        contracts.map((contract) => contract.productName),
        contracts.map((contract) => contract.productKey),
        contracts.map((contract) => contract.amount),
        contracts.map((contract) => String(contract.daysAgo)),
        operatorId,
      ]
    );
  }

  return { inserted: inserted.length, skipped };
}

async function remove(client: PoolClient) {
  const vendors = await client.query<{ vendor_id: string }>(
    'SELECT vendor_id FROM structured.vendor_source_records WHERE source_key = $1',
    [SOURCE_KEY]
  );
  const ids = vendors.rows.map((row) => row.vendor_id);
  const sampleUsers = `SELECT u.id FROM structured.users u
     WHERE u.display_name_user_set = false AND (u.display_name ~ $1 OR u.display_name = ANY($2::text[]))
       AND NOT EXISTS (SELECT 1 FROM identity.identities i WHERE i.user_id = u.id)`;

  await client.query('DELETE FROM structured.vendor_source_records WHERE source_key = $1', [SOURCE_KEY]);
  /*
   * 순서가 중요하다. 후기가 결제인증을 근거로 가리키고 있어(verification_names_its_evidence)
   * 결제인증을 먼저 지우면 후기가 제약에 걸린다. 업체를 먼저 지우면 후기·사진·
   * 후보가 CASCADE로 따라가고, 결제인증은 vendor_id만 NULL이 된다 — 그 다음
   * 샘플 제보자 것을 지운다(탈퇴 정책상 제보자를 지워도 SET NULL로 남기 때문).
   * 계약 표본은 제보자의 웨딩에 매달려 있어 사용자와 함께 사라진다.
   */
  await client.query('DELETE FROM structured.vendors WHERE id = ANY($1::uuid[])', [ids]);
  await client.query(
    `DELETE FROM structured.payment_proofs WHERE reporter_user_id IN (${sampleUsers})`,
    [REPORTER_NAME_PATTERN, OPERATOR_NAMES]
  );
  /*
   * 웨딩(과 그에 매달린 계약 표본)을 사용자보다 먼저 지운다. 사용자를 한 번에 지우면
   * 제보자의 웨딩이 CASCADE로 사라진 뒤에 운영자의 quotes.pii_reviewed_by SET NULL이
   * 같은 quotes 행을 고치려 들고, 이 트랜잭션이 이미 vendor_id를 NULL로 바꾼 행이라
   * Postgres가 wedding_id 외래키를 다시 검사해 실패한다(quotes_wedding_id_fkey).
   */
  await client.query(`DELETE FROM structured.weddings WHERE owner_user_id IN (${sampleUsers})`, [
    REPORTER_NAME_PATTERN,
    OPERATOR_NAMES,
  ]);
  await client.query(`DELETE FROM structured.users u WHERE u.id IN (${sampleUsers})`, [
    REPORTER_NAME_PATTERN,
    OPERATOR_NAMES,
  ]);

  return ids.length;
}

async function main(): Promise<void> {
  if (!argv('yes')) {
    console.error(
      '지어낸 업체를 넣는다. 정말 넣으려면 --yes를 붙일 것.\n' +
        '  npm run seed:samples --workspace @weddingpick/api -- --yes\n' +
        '  npm run seed:samples --workspace @weddingpick/api -- --remove --yes'
    );
    process.exitCode = 1;
    return;
  }

  const pool = createPool(loadConfig().databaseUrl);

  try {
    await withTransaction(pool, async (client) => {
      if (argv('remove')) {
        const removed = await remove(client);

        console.log(`샘플 업체 ${removed}곳과 샘플 제보자를 지웠다.`);
        return;
      }

      const reporters = await seedReporters(client);
      const operatorId = await seedOperator(client);

      for (const category of SAMPLE_CATEGORIES) {
        const result = await seedCategory(client, category, reporters, operatorId);

        console.log(
          `${VENDOR_CATEGORY_LABEL[category]}: ${result.inserted}곳 넣음, ${result.skipped}곳 이미 있음`
        );
      }
    });
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
