# 인계 — 공용 부품

`claude/rn-components` · PR #222. 담당은 `packages/ui/src/**`였다.
대조표는 `docs/rn-migration/COMPONENT_PARITY.md`에 있다.

## 새로 만든 것 (파일별 한 줄)

| 파일 | 한 줄 |
| --- | --- |
| `icon-button.tsx` | 아이콘만 있는 단추. 보이는 40(`Layout.iconButton`) · 손이 닿는 자리 44(`hitSlop`) · `accessibilityLabel` 필수 |
| `card.tsx` | 면 하나. `Radius.medium`(10) · 그림자 없음(`elevation.$rule`) · `plain`/`filled` · `flush` |
| `vendor-card.tsx` | 업체 카드. 사진이 위에 깔리는 세로형. 검색 결과 · 홈 추천 · 비교가 같은 것을 쓴다 |
| `pick-card.tsx` | Pick 목록 카드. 썸네일이 옆에 붙는 가로형 · `Radius.pickCard`(14) |
| `search-bar.tsx` | 검색 칸. `TextField` 위에 돋보기 · 지우기를 얹은 한 겹 |
| `section-header.tsx` | 섹션 제목 줄. 제목 1줄 · `Layout.sectionHeadGap` |
| `segmented-tabs.tsx` | 한 화면 안에서 내용만 바꾸는 줄. 하단 탭 바와 다른 물건 |

## 기존 것에 손댄 곳

**두 곳뿐이다.**

- `text-field.tsx` — `leading` 한 자리를 더했다. `trailing`만 있어서 검색 칸의 돋보기를 넣을 자리가
  없었다. 입력 칸을 두 벌 만들지 않으려고 기존 것을 늘렸다. 기존 호출부는 그대로 돈다.
- `badge.tsx` — `onImage` 갈래를 더했다(`pillOnImage` 면 · `onInk` 글자). 2026-09-14 대표 지시.
  **`brand` 갈래 자체는 고치지 않았다** — 흰 바탕에서 쓰는 자리는 지금 조합이 옳다.

## 안 만든 것과 이유

- **원형 로더** — `circle-loader.tsx`가 이미 있다. 2026-09-11 대표 지시가 커밋 `dcbd19f9`로 반영돼
  있고 `LoadingView`가 기본 원형 / 오래 기다리는 자리 `CategoryCycleLoader`로 갈라 쓴다.
- **Badge · Input · Chip** — `Badge`(kind 6종) · `TextField` · `FilterChip`(size · accent · off)이 이미
  있다. 시안에서 직접 뽑은 값과 갈래를 갖고 있어 새로 만든 것보다 정확하다.
- **Modal** — 지금 필요한 자리를 `showAlert`와 앱의 `BottomSheet`가 덮는다.

## 아직 남은 것

둘 다 **화면 세션이 같은 자리를 고치는 중이라 미뤘다.** 합친 뒤에 한다.

1. **사진 위 pill을 `packages/ui` 부품으로.** 지금은 `Badge`의 `onImage` 갈래이고, 검색 화면
   (`search/index.tsx`)이 같은 모양을 인라인으로 따로 그린다. 부품으로 올리면 중복 하나가 정리된다.
2. **`BottomSheet` · `BottomNavigation` 승격.** 앱 쪽 공용 파일이다 —
   `apps/mobile/src/features/common/bottom-sheet.tsx`(화면 12곳이 쓴다) ·
   `features/navigation/tab-bar.tsx`(expo-router `BottomTabBarProps`에 묶여 있다).

**그리고 하나 더 — 검색 화면의 광고 pill이 지금 깨져 있다.**
`apps/mobile/src/app/(tabs)/search/index.tsx:1066`이 pill 글자에 `theme.onTint`를 쓴다. 새 팔레트
(#225)에서 `onTint`가 플럼 `#371B34`로 바뀌면서 **검은 반투명 위에 검은 글자**가 됐다. 내 담당
밖이라 손대지 않았다. 고칠 때는 `onInk`로 간다 — `badge.tsx`의 `onImage` 갈래와 같은 이유다.

## 함정

- **`onTint`는 흰색이 아니다.** 새 팔레트에서 플럼 `#371B34`다. 키 컬러(#E7898D) 면 위에서 흰 글자가
  2.51:1이라 어둡게 간 값이고, 그 자리에서는 옳다. **어두운 면 위의 흰 글자는 `onInk`다.**
- **`tint`를 글자색으로 쓰지 않는다.** 흰 바탕에서 2.51:1이다. 옅은 면 위 글자는 `tintDark`.
- **`scrim`과 `pillOnImage`는 다르다.** `scrim`은 라이트 .45 · 다크 .72로 갈리고, `pillOnImage`는
  두 모드 모두 rgba(0,0,0,.5)다. 사진 위 pill은 `pillOnImage`다.
- **`VendorCard`와 `PickCard`를 합치지 마라.** 전자는 아직 고르지 않은 업체를 훑는 카드(사진이
  먼저), 후자는 담아 둔 것을 비교하고 결정하는 카드(업종 · 결정 여부 · 빼기가 먼저)다. 같은
  정보라도 읽는 순서가 다르다.
- **금액은 `priceLine(paidPrice, guidePrice)`의 결과만 받는다.** `packages/ui`는 `packages/domain`을
  import하지 않는 표시 전용이다 — 금액 규칙을 두 벌 두지 않는다.
- **`Radius.card`(14)는 Pick 카드용이다.** 일반 카드는 `Radius.medium`(10)이다. 이름이 헷갈리게
  남아 있고 `pickCard`가 새 이름이다.
- **`spec/tokens.json` · `theme.ts` · `design-tokens.ts`는 토큰 세션 것이다.** 이 브랜치는 머지할
  때마다 `main` 쪽을 통째로 받았다.
