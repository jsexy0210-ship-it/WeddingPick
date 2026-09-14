/**
 * 회원 활동 원장(1층)과 집계층(2층)의 규칙.
 *
 * 표는 `packages/db/migrations/0280_activity_ledger.sql`에 있고, 여기에는 **왜 그
 * 값인지**와 **자유 입력을 어느 목록값으로 접는지**가 있다. 접는 규칙이 코드에
 * 있어야 「이게 정말 익명인가」를 나중에 다시 따질 수 있다.
 *
 * 대표 지시(2026-09-14) — 회원 활동을 대표님이 확인할 수 있게 정리하고, 추후
 * 판매할 수 있는 모양으로 쌓는다. **판매 자체는 이번 범위가 아니다.**
 */

import { DISCLOSURE_THRESHOLDS } from './disclosure';
import { VENDOR_CATEGORIES, VENDOR_CATEGORY_LABEL, type VendorCategory } from './vendor';
import { WEDDING_REGIONS, type WeddingRegion } from './wedding-region';

/**
 * 활동이 일어난 자리. 2026-09-14 대표님 확정 IA의 탭 다섯과, 탭이 아닌 자리 다섯.
 *
 * **검색이 탭 목록에 없고 여기에는 있다.** 검색은 탭에서 내려와 홈 상단 검색바로
 * 들어가지만 화면은 살아 있다(대표님 — 「차후에 탭으로 이관한다」). 원장이 담는
 * 것은 탭이 무엇인가가 아니라 어느 자리에서 일어났는가라서, 탭으로 돌아와도 이
 * 목록은 바뀌지 않는다.
 */
export const ACTIVITY_SURFACES = [
  'home',
  'wedding_note',
  'pick',
  'lounge',
  'my',
  'search',
  'vendor',
  'onboarding',
  'report',
  'account',
] as const;

export type ActivitySurface = (typeof ACTIVITY_SURFACES)[number];

/** 관리자 화면에 쓰는 이름. 코드를 그대로 보여주지 않는다. */
export const ACTIVITY_SURFACE_LABEL: Record<ActivitySurface, string> = {
  home: '홈',
  wedding_note: '웨딩노트',
  pick: 'Pick',
  lounge: '라운지',
  my: 'MY',
  search: '검색',
  vendor: '업체 상세',
  onboarding: '온보딩',
  report: '제보',
  account: '계정',
};

/**
 * 원장이 받는 사건 열하나.
 *
 * **한 줄은 한 사건이다.** 「세 곳을 봤다」는 세 줄이고, 「비교하고 A를 골랐다」는
 * 비교 한 줄과 Pick 한 줄이다. 비교 결과를 한 줄에 담지 않는 이유는
 * 0280 마이그레이션 주석에 적어 뒀다 — 그 한 줄이 사람을 그린다.
 */
export const ACTIVITY_EVENT_NAMES = [
  'screen_view',
  'search_submitted',
  'category_selected',
  'pick_added',
  'pick_removed',
  'compare_started',
  'vendor_viewed',
  'report_submitted',
  'visit_note_written',
  'onboarding_step',
  'withdrawal_requested',
] as const;

export type ActivityEventName = (typeof ACTIVITY_EVENT_NAMES)[number];

export const ACTIVITY_EVENT_LABEL: Record<ActivityEventName, string> = {
  screen_view: '화면 열기',
  search_submitted: '검색',
  category_selected: '업종 고르기',
  pick_added: 'Pick 담기',
  pick_removed: 'Pick 빼기',
  compare_started: '비교 시작',
  vendor_viewed: '업체 열람',
  report_submitted: '제보 제출',
  visit_note_written: '방문노트 작성',
  onboarding_step: '온보딩 단계',
  withdrawal_requested: '탈퇴 접수',
};

/**
 * 원장에 **일부러 담지 않는 것.** 무엇을 안 담는지는 무엇을 담는지만큼 중요하다 —
 * 적어두지 않으면 다음 사람이 「빠졌네」 하고 채운다.
 */
export const ACTIVITY_OMITTED = [
  '스크롤 위치 · 체류 시간 · 누른 자리의 좌표 — 화면 하나를 얼마나 오래 봤는지까지 세면 행동이 아니라 사람이 기록된다',
  '방문노트와 메모의 본문 — 적었다는 사실만 남기고 글은 담지 않는다',
  '알림 발송과 열람 — 이미 notification_deliveries가 담는다. 같은 것을 두 곳에 적지 않는다',
  '접속 IP · 기기 식별자 — 처리방침의 「서비스 보안·운영」 항목이 따로 담는 값이다. 원장은 행동만 받는다',
  '전화번호 · 카드번호 · 결제 증빙 원문 · 녹음 — 스키마 CHECK가 막는다',
] as const;

/**
 * ── 2층의 최소 인원 기준 ───────────────────────────────────────────────────
 *
 * **한 묶음에 서로 다른 회원이 열 명 미만이면 행 자체를 내보내지 않는다.**
 *
 * 새 수를 만들지 않고 `DISCLOSURE_THRESHOLDS.detailed`를 그대로 쓴다. 저장소는
 * 이미 「한 사람의 값이 숫자로 드러나는가」를 그 수로 가르고 있다 — 실 제보의
 * 기준금액이 밖으로 나갈 수 있는 문턱이 10이다. 같은 성격의 판단에 문턱을 둘로
 * 두면 언젠가 한쪽만 고쳐진다.
 *
 * 왜 3이 아닌지는 세 가지다.
 *
 *   - 3은 한 업체·한 축(금액)에 대한 구간 문턱이다. 2층은 기간·자리·업종·지역·
 *     예산을 겹친다. 겹친 축이 많을수록 같은 인원이라도 좁혀지기 쉽다.
 *   - 3과 5는 앱 안에서 보이는 값이라 잘못 잡으면 내리면 된다. 2층은 계약으로
 *     밖에 나가고, 나간 뒤에는 지울 수 없다.
 *   - 개인정보보호위원회 가이드라인이 예시로 드는 3 이상은 가명정보(안에서 결합·
 *     분석)의 이야기다. 익명정보로 밖에 내보내는 자리는 그보다 높게 잡는다.
 *
 * 겹치는 축의 수 자체도 제한한다(`ACTIVITY_MAX_AXES`). 인원만으로는 모자라다 —
 * 열 명이 들어도 「서울 · 스튜디오 · 3천만원대」는 한 줄로 사람을 그린다.
 */
export const ACTIVITY_MIN_SUBJECTS = DISCLOSURE_THRESHOLDS.detailed;

/** 한 행에서 겹칠 수 있는 축의 수. 지역·업종·예산 중 둘까지. */
export const ACTIVITY_MAX_AXES = 2;

/** 묶는 기간. 주와 4주만 쓴다 — 달은 28·30·31이 섞여 묶음 크기가 달라진다. */
export const ACTIVITY_PERIOD_DAYS = [7, 28] as const;

export type ActivityPeriodDays = (typeof ACTIVITY_PERIOD_DAYS)[number];

/**
 * 접는 규칙의 판. **2층 행마다 이 문자열이 함께 저장된다.**
 *
 * 규칙을 고치면 이 값을 올린다 — 옛 판으로 뽑은 행과 새 판으로 뽑은 행이 섞이면
 * 어느 기준으로 접힌 값인지 알 수 없고, 그러면 익명성을 다시 따질 근거가 없다.
 */
export const ACTIVITY_FOLD_RULE = 'fold/v1';

/**
 * ── 자유 입력을 접는다 ─────────────────────────────────────────────────────
 *
 * 검색어는 사람이 직접 치는 말이라 그대로는 2층에 올릴 수 없다. 「강남 스튜디오
 * 저렴한 곳」 한 줄은 그 자체로 한 사람이다.
 *
 * 목록에 있는 값으로만 접는다 — 업종 이름 하나와 지역 이름 하나. 어느 쪽에도
 * 걸리지 않으면 둘 다 없는 것으로 두고, 그러면 그 검색은 「업종도 지역도 아닌 말」
 * 묶음에 든다. **접히지 않은 말을 그대로 올리는 길은 없다.**
 */
export type FoldedSearch = {
  category: VendorCategory | null;
  region: WeddingRegion | null;
};

/**
 * 검색어에서 업종 이름과 지역 이름만 집어낸다.
 *
 * 화면에 보이는 이름으로 맞춘다(«스튜디오» · «본식스냅» · «결정사»). 코드값
 * («studio»)으로도 치는 사람은 없고, 두 이름을 함께 받으면 같은 것이 두 묶음이 된다
 * (2026-09-11 대표 지시 — 같은 것을 두 이름으로 부르지 않는다).
 *
 * **여럿이 걸리면 접지 않는다.** 「스튜디오 드레스」처럼 둘이 함께 든 말은 어느
 * 쪽으로도 셀 수 없다 — 하나를 골라 세면 그 선택이 곧 지어낸 값이다.
 */
export function foldSearchText(text: string): FoldedSearch {
  const haystack = text.trim();

  const categories = VENDOR_CATEGORIES.filter((key) =>
    haystack.includes(VENDOR_CATEGORY_LABEL[key])
  );
  const regions = WEDDING_REGIONS.filter((name) => haystack.includes(name));

  return {
    category: categories.length === 1 ? categories[0]! : null,
    region: regions.length === 1 ? regions[0]! : null,
  };
}

/**
 * 이 행을 2층에 올려도 되는가.
 *
 * 뽑는 코드가 이것만 지나면 된다. 스키마의 CHECK가 같은 것을 한 번 더 막지만,
 * 그건 마지막 그물이지 판단하는 자리가 아니다 — 여기서 떨어진 묶음은 **행 자체가
 * 만들어지지 않아야** 하고, CHECK에 걸려 트랜잭션이 터지는 것과는 다르다.
 */
export function canPublishRollup(input: {
  subjectCount: number;
  region: string | null;
  category: string | null;
  budgetBracket: string | null;
}): boolean {
  const axes =
    (input.region === null ? 0 : 1) +
    (input.category === null ? 0 : 1) +
    (input.budgetBracket === null ? 0 : 1);

  return input.subjectCount >= ACTIVITY_MIN_SUBJECTS && axes <= ACTIVITY_MAX_AXES;
}

/**
 * 주의 시작(월요일). 기간을 묶는 자리가 여럿이라 한 곳에서 정한다.
 *
 * UTC로 센다 — 저장하는 값과 스케줄은 UTC 그대로 둔다는 규칙 그대로다. 사람에게
 * 보일 때만 KST로 바꾼다.
 */
export function weekStart(at: Date): Date {
  const day = at.getUTCDay();
  // 일요일(0)은 지난 월요일이 엿새 전이다.
  const back = day === 0 ? 6 : day - 1;

  return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate() - back));
}
