import { TASTES, type Taste } from '@weddingpick/api-contract';

import { getTaste, updateTaste } from '@/api/client';

/**
 * 취향. 홈 C-1 시안 1 — 사진 넉 장으로 «어떤 결혼식을 원하세요?»를 받는 자리.
 *
 * 서버(`/v1/me/taste`)에 저장한다 — 로그인한 사람에게만 이 화면이 뜨므로
 * (`state.ts`의 `guest` 갈림), 기기를 바꿔도 고른 것이 남는다.
 *
 * 화면을 비워두지 않는 이유는, 취향이 없는 사람에게 개인화 추천을 띄우면
 * 앱이 아는 척을 하기 때문이다. 고른 것을 «무엇을 골랐는지»만으로 홈이 다음
 * 얼굴로 넘어갈 수 있다.
 *
 * 서버가 안 불리면(오프라인 등) 조용히 안 고른 것으로 본다 — 그게 취향
 * 화면이 안 뜨는 것보다 낫다. 화면은 `loadTaste`/`saveTaste` 두 함수만
 * 알고 있어서 저장 방식이 바뀌어도 그대로다.
 */

export { TASTES, type Taste };

export const TASTE_LABEL: Record<Taste, string> = {
  white: '깔끔한 화이트',
  daylight: '야외 자연광',
  flower: '플라워 아치',
  classic: '클래식 호텔',
};

/**
 * 취향 카드 사진. 실제 업체 제공 사진이 아직 없어(계약에 그 필드가 없다)
 * 임시로 채운다 — 사용자 지시로 하드코딩했다. Unsplash 라이선스는 출처 표시
 * 없이 상업적으로 써도 되지만, 이 카드에 실제로 뜨는지는 이 저장소에서
 * 확인하지 못했다(egress가 이미지 CDN을 막아 검증 불가) — 배포 후 실기기에서
 * 한 번 확인해달라. `CategoryImage`가 로드 실패를 감지하지 않으므로, 깨지면
 * 조용히 빈 면으로 보이지 않고 로딩 실패 아이콘이 뜰 수 있다.
 *
 * TODO: 실제 업체 사진 파이프라인이 생기면 이 상수를 지우고 서버 값을 쓴다.
 */
export const TASTE_IMAGE: Record<Taste, string> = {
  white: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=800&q=80&auto=format&fit=crop',
  daylight: 'https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?w=800&q=80&auto=format&fit=crop',
  flower: 'https://images.unsplash.com/photo-1519225421980-715cb0215aed?w=800&q=80&auto=format&fit=crop',
  classic: 'https://images.unsplash.com/photo-1529636798458-92182e662485?w=800&q=80&auto=format&fit=crop',
};

/**
 * 요약 한 줄에 쓰는 짧은 이름. 온보딩 완료 시안(01-onboarding #11e summarySet)이
 * «화이트 · 자연광»으로 적는다 — 카드 라벨의 마지막 낱말이다. 시안이 보여주지 않은
 * 둘(아치·호텔)도 같은 규칙으로 뽑았다.
 */
export const TASTE_SHORT_LABEL: Record<Taste, string> = {
  white: '화이트',
  daylight: '자연광',
  flower: '아치',
  classic: '호텔',
};

function isTaste(value: string): value is Taste {
  return (TASTES as readonly string[]).includes(value);
}

/** 저장된 것 중 모르는 값은 버린다. 항목이 바뀌어도 화면이 빈 칸을 그리지 않게. */
export function reconcileTaste(stored: readonly string[] | null): readonly Taste[] {
  return (stored ?? []).filter(isTaste);
}

/** 하나라도 골랐는가. 홈이 취향 고르기를 계속 띄울지 이 값으로 정한다. */
export function hasTaste(chosen: readonly Taste[]): boolean {
  return chosen.length > 0;
}

/** 눌렀던 것을 다시 누르면 빠진다. 한 번 고르면 못 무르는 화면을 만들지 않는다. */
export function toggleTaste(chosen: readonly Taste[], taste: Taste): readonly Taste[] {
  return chosen.includes(taste)
    ? chosen.filter((row) => row !== taste)
    : [...chosen, taste];
}

export async function loadTaste(): Promise<readonly Taste[]> {
  try {
    return reconcileTaste((await getTaste()).tastes);
  } catch {
    // 못 불러오거나(오프라인·미로그인) 서버가 이상하면 안 고른 것으로 본다.
    // 홈이 안 뜨는 것보다 낫다.
    return [];
  }
}

export async function saveTaste(chosen: readonly Taste[]): Promise<void> {
  try {
    await updateTaste(chosen);
  } catch {
    // 화면은 이미 낙관적으로 갱신됐다(app/(tabs)/index.tsx) — 저장이 실패해도
    // 다음에 다시 열면 서버 값으로 되돌아갈 뿐, 여기서 사용자를 막지 않는다.
  }
}
