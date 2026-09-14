import {
  CONSULTATION_CATEGORIES,
  CONSULTATION_STATUSES,
  type ConsultationCategory,
} from '@weddingpick/domain';
import { z } from 'zod';

/**
 * 상담 녹음에서 무엇을 뽑는가 — **규칙 한 벌.**
 *
 * 결제내역(`payment-reading-spec.ts`)과 같은 자리다. 스키마를 손으로 두 벌 적으면
 * 칸 하나를 더할 때 한쪽만 고쳐지고, 그 순간 모델이 채울 수 있는 칸과 우리가 받는
 * 칸이 어긋난다. 여기서 만든 zod를 Gemini 요청 스키마로 변환해 보낸다.
 *
 * ## 담을 칸이 없으면 못 쓴다
 *
 * 전화번호 · 계좌번호 · 카드번호 · 주민등록번호를 담는 칸이 **어디에도 없다.**
 * 「적지 마라」고 부탁하는 대신 적을 곳을 없앤다 — 구조화 출력이라 스키마 밖의
 * 값은 아예 나오지 못한다. 결제내역에서 카드번호 칸을 없앤 것과 같다.
 *
 * **녹취록을 담을 칸도 없다.** 금액에만 40자 이내의 짧은 인용을 남긴다
 * (2026-09-14 대표 결정 P-5) — 사용자가 금액을 고칠 근거는 남기되 대화는
 * 복원되지 않는 길이다.
 */

/** 못 들었으면 null이다. 짐작한 값과 들은 값을 같은 칸에 담지 않는다. */
const text = (description: string) => z.string().nullable().describe(description);
const won = (description: string) => z.number().int().nullable().describe(`${description} 단위는 원.`);
const count = (description: string) => z.number().int().nullable().describe(description);
const flag = (description: string) => z.boolean().nullable().describe(`${description} 안 들렸으면 null.`);

/**
 * 금액과 그 근거.
 *
 * **인용은 40자까지다.** 길이를 열어두면 그것이 녹취록이 된다 — 개인정보처리방침에
 * 적은 「녹취록은 만들지 않습니다」와 어긋나는 순간 어느 쪽이 맞는지 알 수 없어진다.
 */
const EVIDENCE_MAX = 40;

const money = (description: string) =>
  z
    .object({
      value: won(description),
      confidence: z.number().min(0).max(1).describe('이 금액이 맞다는 확신. 0~1.'),
      evidence: z
        .string()
        .max(EVIDENCE_MAX)
        .nullable()
        .describe(
          `이 금액을 말한 대목. ${EVIDENCE_MAX}자 이내 한 문장. 사람 이름·전화번호·계좌번호가 섞이면 그 부분을 빼고 적어라. 없으면 null.`
        ),
    })
    .describe(description);

/** 어느 상담에서나 뽑는 것. 요청 §10. */
export const commonFieldsSchema = z.object({
  vendorName: text('업체 이름. 말한 그대로. 상담사 이름을 여기 넣지 마라.'),
  branchName: text('지점 이름.'),
  consultedOn: text('상담한 날. YYYY-MM-DD. 대화에 없으면 null — 오늘로 채우지 마라.'),
  productName: text('상품 이름.'),
  packageName: text('패키지 이름.'),

  listPrice: money('정상가격. 할인 전 금액이다.'),
  quotedTotal: money('그 자리에서 제시한 총액.'),
  discountAmount: money('깎아준 금액.'),
  finalAmount: money('할인까지 반영해 안내한 최종 금액.'),
  depositAmount: money('계약금.'),
  balanceAmount: money('잔금.'),

  promotion: text('진행 중인 혜택·행사 이름.'),
  promotionCondition: text('그 혜택을 받으려면 무엇이 필요한가.'),
  promotionValidUntil: text('혜택 적용 기한. 대화에 없으면 null.'),

  included: z.array(z.string()).describe('기본 가격에 들어 있다고 말한 것.'),
  extraCosts: z.array(z.string()).describe('따로 더 내야 한다고 말한 것.'),
  options: z.array(z.string()).describe('고를 수 있다고 말한 것.'),

  scheduleNote: text('일정에 대해 정해지거나 언급된 것.'),
  changeCondition: text('변경 조건.'),
  cancelCondition: text('취소 조건.'),
  refundCondition: text('환불 조건.'),
});

/** 업종마다 따로 뽑는 것. 요청 §11~§24. */
export const categoryFieldsSchema = {
  hall: z.object({
    hallName: text('홀 이름.'),
    ceremonyDate: text('예식 예정일. YYYY-MM-DD.'),
    ceremonyTime: text('예식 시간.'),
    rentalFee: money('대관료.'),
    mealPrice: money('식대. 1인 기준이면 1인 금액.'),
    guaranteedGuests: count('보증인원.'),
    minCapacity: count('최소 수용인원.'),
    maxCapacity: count('최대 수용인원.'),
    ceremonyInterval: text('예식 간격.'),
    ceremonyStyle: text('동시예식인가 분리예식인가.'),
    mealStyle: text('식사 형태.'),
    alcoholCost: money('주류 비용.'),
    beverageCost: money('음료 비용.'),
    flowerCost: money('꽃장식 비용.'),
    stagingCost: money('연출 비용.'),
    parkingSpaces: count('주차 가능 대수.'),
    freeParkingHours: text('무료 주차시간.'),
    extraParkingFee: money('추가 주차비.'),
    brideRoom: text('신부대기실.'),
    parentsRoom: text('혼주실.'),
    pyebaekRoom: text('폐백실.'),
    sameDayBenefit: text('그날 계약하면 준다고 한 것.'),
    guestCountDeadline: text('보증인원을 마지막으로 바꿀 수 있는 날.'),
  }),

  studio: z.object({
    shootDate: text('촬영 예정일. YYYY-MM-DD.'),
    shootHours: text('촬영시간.'),
    concept: text('촬영 콘셉트.'),
    photographer: text('촬영 작가.'),
    outfitCount: count('의상 벌수.'),
    originalsIncluded: flag('원본을 준다고 했는가.'),
    originalsCost: money('원본 비용.'),
    retouchedCount: count('보정본 수.'),
    album: text('앨범 구성.'),
    frame: text('액자 구성.'),
    extraPageCost: money('페이지 추가비.'),
    outdoorShoot: flag('야외촬영이 있는가.'),
    locationCost: money('장소 추가비.'),
    photographerPickCost: money('작가 지정비.'),
    extraHourCost: money('추가 촬영시간 비용.'),
    selectionSchedule: text('사진 고르는 일정.'),
    deliveryEstimate: text('결과물 예상 수령일.'),
  }),

  dress: z.object({
    usage: text('촬영용인가 본식용인가.'),
    shopGrade: text('드레스샵 등급.'),
    brand: text('브랜드.'),
    tourFee: money('투어비.'),
    fittingFee: money('피팅비.'),
    fittingCount: count('피팅 가능 벌수.'),
    shootDressCount: count('촬영 드레스 벌수.'),
    ceremonyDressCondition: text('본식 드레스 조건.'),
    importedSurcharge: money('수입드레스 추가금.'),
    blackLabelSurcharge: money('블랙라벨 추가금.'),
    staffPickCost: money('담당자 지정비.'),
    helperFee: money('헬퍼비.'),
    alterationSchedule: text('가봉 일정.'),
    accessoriesIncluded: flag('액세서리가 들어 있는가.'),
    veilIncluded: flag('베일이 들어 있는가.'),
    extraFittingFee: money('추가 피팅비.'),
  }),

  makeup: z.object({
    brideService: text('신부 구성.'),
    groomService: text('신랑 구성.'),
    artistGrade: text('담당자 등급.'),
    isDirector: flag('원장 또는 부원장인가.'),
    artistPickCost: money('담당자 지정비.'),
    hairIncluded: flag('헤어가 들어 있는가.'),
    earlyStartCost: money('얼리스타트 비용.'),
    onSite: flag('출장을 오는가.'),
    travelCost: money('출장비.'),
    retouchIncluded: flag('리터치가 들어 있는가.'),
    retouchCost: money('리터치 비용.'),
    parentsMakeup: text('혼주 메이크업.'),
    parentsHair: text('혼주 헤어.'),
    extraPersonCost: money('추가 인원 비용.'),
    startTime: text('시작시간.'),
    estimatedDuration: text('예상 소요시간.'),
  }),

  hair: z.object({
    usage: text('촬영용인가 본식용인가.'),
    baseHours: text('기본 이용시간.'),
    changeCount: count('헤어변형 횟수.'),
    styleCount: count('스타일 수.'),
    artist: text('담당자.'),
    travelCost: money('출장비.'),
    regionSurcharge: money('지역 추가비.'),
    earlyStartCost: money('얼리스타트 비용.'),
    overtimeCost: money('시간 연장비.'),
    ornamentIncluded: flag('헤어장식이 들어 있는가.'),
    freshFlowerAllowed: flag('생화를 쓸 수 있는가.'),
    accompanyScope: text('어디까지 동행하는가.'),
    startTime: text('시작시간.'),
    endTime: text('종료시간.'),
  }),

  snap: z.object({
    crewSize: count('촬영 인원.'),
    mainPhotographer: text('메인작가.'),
    subPhotographer: text('서브작가.'),
    startPoint: text('촬영 시작시점.'),
    endPoint: text('촬영 종료시점.'),
    formalShotIncluded: flag('원판촬영이 들어 있는가.'),
    pyebaekIncluded: flag('폐백촬영이 들어 있는가.'),
    originalsIncluded: flag('원본을 준다고 했는가.'),
    retouchedCount: count('보정본 수.'),
    album: text('앨범 구성.'),
    photographerPickCost: money('작가 지정비.'),
    travelCost: money('출장비.'),
    originalsDelivery: text('원본 예상 수령일.'),
    albumDelivery: text('앨범 예상 수령일.'),
  }),

  iphone_snap: z.object({
    shootHours: text('촬영시간.'),
    shootScope: text('촬영범위.'),
    photoCount: count('사진 예상 수.'),
    videoCount: count('영상 예상 수.'),
    originalsIncluded: flag('원본을 준다고 했는가.'),
    instantDelivery: flag('찍고 바로 보내주는가.'),
    retouched: flag('보정을 해주는가.'),
    shortFormIncluded: flag('짧은 영상을 주는가.'),
    crewSize: count('작가 수.'),
    travelCost: money('출장비.'),
    extraHourCost: money('추가시간 비용.'),
  }),

  wedding_video: z.object({
    crewSize: count('촬영 인원.'),
    cameraCount: count('카메라 수.'),
    shootScope: text('촬영범위.'),
    is4k: flag('4K로 찍는가.'),
    highlightVideo: text('하이라이트 영상 구성.'),
    fullVideo: text('전체영상 구성.'),
    interviewIncluded: flag('인터뷰가 들어 있는가.'),
    originalsIncluded: flag('원본을 준다고 했는가.'),
    finalLength: text('최종 영상길이.'),
    revisionCount: count('수정 가능 횟수.'),
    deliveryEstimate: text('예상 납품기간.'),
    travelCost: money('출장비.'),
  }),

  suit: z.object({
    madeOrRented: text('맞춤인가 대여인가.'),
    fabricBrand: text('원단 브랜드.'),
    fabricOrigin: text('국내 원단인가 수입 원단인가.'),
    included: text('기본 구성.'),
    shirtIncluded: flag('셔츠가 들어 있는가.'),
    vestIncluded: flag('조끼가 들어 있는가.'),
    shoesIncluded: flag('구두가 들어 있는가.'),
    tieIncluded: flag('타이가 들어 있는가.'),
    shootSuitRental: flag('촬영복을 빌려주는가.'),
    fittingCount: count('가봉 횟수.'),
    productionPeriod: text('제작기간.'),
    alteration: text('체형수선.'),
    surcharge: money('추가금.'),
    returnCondition: text('대여 반납조건.'),
  }),

  goods: z.object({
    item: text('품목.'),
    brand: text('브랜드.'),
    isWeddingBand: flag('웨딩밴드인가.'),
    material: text('소재.'),
    goldPurity: text('금 함량.'),
    diamondCarat: text('다이아몬드 중량.'),
    diamondGrade: text('다이아몬드 등급.'),
    diamondOrigin: text('천연인가 랩그로운인가.'),
    ringSize: text('사이즈.'),
    engraving: text('각인.'),
    designChange: text('디자인 변경.'),
    productionPeriod: text('제작기간.'),
    afterService: text('A/S 조건.'),
    sizeAdjustment: text('사이즈 수선.'),
    certificateIncluded: flag('보증서를 주는가.'),
  }),

  bouquet: z.object({
    bouquetComposition: text('부케 구성.'),
    boutonniere: text('부토니에.'),
    corsage: text('코사지.'),
    flowerTypes: z.array(z.string()).describe('말한 꽃 종류.'),
    freshOrArtificial: text('생화인가 조화인가.'),
    canPickFlower: flag('원하는 꽃을 고를 수 있는가.'),
    seasonSubstitute: text('철이 아닐 때 대신 쓰는 꽃.'),
    colorMood: text('색상·분위기.'),
    delivery: text('배송.'),
    setup: text('설치.'),
    preservation: text('보존처리.'),
    extras: z.array(z.string()).describe('더할 수 있다고 말한 구성.'),
  }),

  wedding_info_company: z.object({
    accompanies: flag('동행하는가.'),
    planningFee: money('플래닝 비용.'),
    plannerName: text('담당자.'),
    consultScope: text('상담범위.'),
    partnerScope: text('제휴업체 범위.'),
    packageComposition: text('스드메 구성.'),
    accompanyCount: count('동행 횟수.'),
    scheduleScope: text('일정관리 범위.'),
    contractScope: text('계약관리 범위.'),
    benefitsOffered: text('제공한다고 말한 혜택.'),
    commission: money('수수료.'),
    staffChangeCondition: text('담당자 변경 조건.'),
  }),

  honeymoon: z.object({
    destination: text('여행지.'),
    departureDate: text('출발 예정일. YYYY-MM-DD.'),
    duration: text('여행기간.'),
    airline: text('항공사.'),
    directOrLayover: text('직항인가 경유인가.'),
    seatClass: text('좌석등급.'),
    accommodation: text('호텔 또는 리조트.'),
    roomGrade: text('객실등급.'),
    mealScope: text('식사 포함범위.'),
    transport: text('이동수단.'),
    includedTours: z.array(z.string()).describe('포함된 투어.'),
    freeTime: text('자유일정.'),
    notIncluded: z.array(z.string()).describe('불포함사항.'),
    travelInsurance: text('여행자보험.'),
    reservationFee: money('예약금.'),
    cancelFee: text('취소수수료.'),
  }),

  dowry: z.object({
    brand: text('브랜드.'),
    modelName: text('모델명.'),
    item: text('품목.'),
    salePrice: money('판매가격.'),
    packageDiscount: money('패키지 할인.'),
    cardBenefit: text('카드 혜택.'),
    giveaway: text('사은품.'),
    installCost: money('설치비.'),
    deliveryCost: money('배송비.'),
    deliveryDate: text('배송 예정일.'),
    installDate: text('설치 예정일.'),
    warrantyPeriod: text('보증기간.'),
    afterService: text('A/S 조건.'),
    exchangeCondition: text('교환 조건.'),
  }),
} satisfies Record<(typeof CONSULTATION_CATEGORIES)[number], z.ZodObject>;

/**
 * 뽑은 값을 다시 정리한 것. 요청 §25.
 *
 * **`missingInformation`이 이 기능의 값어치다.** 상담에서 들은 것을 적어주는 것보다
 * **못 들은 것을 짚어주는 것**이 계약 전에 쓸모 있다 — 「주류 비용은 확인되지
 * 않았어요」가 그 자리다.
 */
export const afterFieldsSchema = z.object({
  summary: text('상담 핵심내용. 세 줄 이내. 대화를 옮겨 적지 마라.'),
  additionalCosts: z
    .array(z.string())
    .describe('기본 가격 말고 더 내야 하는 것. 지정비·헬퍼비·출장비·얼리스타트·원본비 같은 것.'),
  benefits: z
    .array(z.string())
    .describe('깎아주거나 더 준다고 한 것. 조건이나 기한이 분명하지 않으면 그 사실을 함께 적어라.'),
  warnings: z
    .array(z.string())
    .describe('조심할 것. 취소수수료 · 추가금이 생길 수 있는 자리 · 일정 변경 제한 · 조건부 할인.'),
  missingInformation: z
    .array(z.string())
    .describe(
      '이 업종에서 보통 정하는데 이 상담에서는 확인되지 않은 것. 계약 전에 다시 물어볼 것을 문장으로 적어라.'
    ),
});

/** 1차 판정이 돌려주는 것. 요청 §6. */
export const classificationSchema = z.object({
  status: z.enum(CONSULTATION_STATUSES),
  isWeddingConsultation: z.boolean(),
  isSupportedCategory: z.boolean(),
  category: z.enum(CONSULTATION_CATEGORIES).nullable().describe('지원 업종이면 어느 것인지.'),
  confidence: z.number().min(0).max(1),
  consultationSignals: z.object({
    vendorCustomerConversation: z.boolean().describe('업체와 고객이 주고받는 자리인가.'),
    productOrServiceDiscussion: z.boolean().describe('상품·서비스 설명이 있는가.'),
    pricingMentioned: z.boolean(),
    scheduleMentioned: z.boolean(),
    contractMentioned: z.boolean(),
    benefitMentioned: z.boolean(),
  }),
  evidence: z
    .array(z.string().max(EVIDENCE_MAX))
    .max(3)
    .describe(`그렇게 판단한 근거가 된 대목. 셋까지, 각 ${EVIDENCE_MAX}자 이내.`),
  reason: text('한 줄로 무엇이라 판단했는지.'),
});

export type Classification = z.infer<typeof classificationSchema>;

/** 1차 판정 지시문. **여기서는 아무것도 뽑지 않는다** — 무엇인지만 가른다. */
export const CLASSIFY_PROMPT = `너는 올라온 녹음이 웨딩업체 상담인지 가른다. 값을 뽑는 일은 다음 단계가 한다.

1. **웨딩 단어가 나왔다고 웨딩 상담이 아니다.** 친구끼리 결혼 얘기를 하는 것도 웨딩
   단어가 많이 나온다. 업체와 고객이 주고받는 자리인지를 본다.
2. 상품·서비스 설명이 있는지 본다. 값을 묻고 답하는 대목이 있으면 그렇다.
3. 가격 · 일정 · 계약 · 혜택 중 무엇이 나왔는지 각각 표시한다. **없는 것을 있다고
   하지 마라** — 이 표시로 다음 단계를 부를지 정한다.
4. 웨딩 상담이 맞는데 청첩장 · 한복 · 답례품이면 UNSUPPORTED_WEDDING_CONSULTATION이다.
5. 일상대화 · 회사회의 · 보험상담 · 휴대폰상담 · 영업전화 · 음식점 예약 · 잡담이면
   NOT_WEDDING_CONSULTATION이다.
6. 확신이 없으면 confidence를 낮게 준다. 낮으면 사람에게 묻는 자리로 간다 —
   틀린 판단을 높은 확신으로 주는 것보다 낫다.
7. evidence는 판단 근거가 된 대목을 ${EVIDENCE_MAX}자 이내로 셋까지. **사람 이름 ·
   전화번호 · 계좌번호가 섞이면 그 부분을 빼고 적어라.**`;

/** 2차 추출 지시문. 요청 §26의 환각 방지 규칙이 그대로 들어 있다. */
export const EXTRACT_PROMPT = `너는 웨딩업체 상담 녹음에서 정해진 칸을 채운다.

1. **대화를 옮겨 적지 마라.** 녹취록을 만드는 일이 아니다.
2. 들리지 않은 값은 null로 둔다. **짐작해서 채우지 마라.**
3. 숫자는 **실제로 말한 것만** 적는다. 계산해서 만들지 마라.
4. **정상가격과 할인가격을 섞지 마라.** 어느 쪽인지 분명하지 않으면 최종금액을
   null로 두고 confidence를 낮춘다.
5. 날짜를 임의로 보정하지 마라. 대화에 없으면 null이다 — **오늘 날짜로 채우지 마라.**
6. 업체 이름·상품 이름을 지어내지 마라.
7. 「약」 「정도」 「부터」 「최대」처럼 업체가 붙여 말한 표현은 **그대로 옮긴다.**
   그 말이 조건이다 — 떼어내면 확정 금액으로 읽힌다.
8. **사람 이름을 어느 칸에도 넣지 마라.** 업체 이름 자리에 상담사 이름을 넣는
   실수가 가장 흔하다.
9. 전화번호 · 계좌번호 · 카드번호 · 주민등록번호를 **어느 칸에도 적지 마라.**
10. 업종에 억지로 맞추지 마라. 그 업종에서 안 나오는 값이면 null이다.
11. missingInformation에는 **이 업종에서 보통 정하는데 이 상담에서 확인되지 않은
    것**을 적는다. 계약 전에 다시 물어볼 것을 문장으로 쓴다.
12. 금액의 evidence는 그 금액을 말한 대목을 ${EVIDENCE_MAX}자 이내 한 문장으로.
    **사람 이름·전화번호·계좌번호가 섞이면 그 부분을 빼고 적어라.**`;

/**
 * 그 업종의 2차 추출 스키마. 공통 + 업종별 + 후처리를 한 덩어리로 묶는다.
 *
 * **업종마다 다른 칸만 보낸다.** 열네 종을 다 합쳐 보내면 웨딩홀 상담에 「원단
 * 브랜드」 칸이 딸려가고, 모델은 빈 칸을 채우려 든다.
 */
export function readingSchemaFor(category: ConsultationCategory) {
  return z.object({
    common: commonFieldsSchema,
    categoryData: categoryFieldsSchema[category],
    after: afterFieldsSchema,
  });
}

export type ConsultationReading = z.infer<ReturnType<typeof readingSchemaFor>>;
