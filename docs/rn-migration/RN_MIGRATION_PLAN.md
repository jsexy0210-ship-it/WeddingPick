# 디자인 개편 실행 계획 (2~5단계)

작성 2026-09-14 (KST) · 1단계 설계 세션 산출물 · 브랜치 `claude/rn-migration-plan`
**이 문서는 계획이다. 1단계에서는 코드·토큰을 한 줄도 고치지 않았다.**

## 0. 전제 바로잡기 — 계획이 서기 전에 합의할 것

| 흔한 오해 | 실제 |
|---|---|
| 「웹을 RN으로 전환한다」 | `apps/mobile`은 **이미 Expo/RN**이다. WebView는 `features/webshell/WebShellView.tsx` 한 곳뿐. 이번 과제는 **이미 RN인 앱의 UI 층 개편**이다 |
| 「토큰 한 파일만 바꾸면 된다」 | **두 파일이다.** `spec/tokens.json`(정본)과 `packages/ui/src/theme.ts`(손으로 옮겨 적은 사본). `gen-tokens.js`는 ios/android/web만 생성하고 `theme.ts`는 만들지 않는다 |
| 「하드코딩 0건이라 안전하다」 | `packages/ui/src/wedding-mark.tsx:38`의 `color = '#ff6f61'` 기본 인자는 **토큰을 바꿔도 따라오지 않는다** |
| 「Figma A등급에서 값을 캔다」 | A등급의 색·서체는 대표 결정으로 배제된 구세대이고, 여백은 절대좌표다. **색·서체의 실질 출처는 `theme.css`(대표 확정)뿐이다** |
| 「크림 바탕으로 바꾼다」 | **크림색 값이 어디에도 없다.** 대표 판단 없이는 착수할 수 없다 |

## 1. 단계 경계

```
1단계  설계 · 문서       ← 지금 (이 문서 포함 4개)
2단계  골격             토큰 · 공용 컴포넌트 · 네비게이션 · 인증
3단계  화면 구현         ADAPT 화면 개편
4단계  검증 · QA
5단계  릴리스
```

**경계 원칙: 2단계는 화면 파일을 열지 않는다. 3단계는 토큰을 고치지 않는다.**
이 선을 지켜야 「토큰이 잘못돼서 화면이 틀린 건지, 화면을 잘못 짠 건지」를 가를 수 있다.

## 2. 2단계 — 골격

### 2-1. 착수 전 필수 — 대표 판단 (블로커)

아래가 정해지기 전에는 2단계를 **시작할 수 없다.** 추측으로 값을 넣으면 3단계 전체를 다시 해야 한다.

| # | 판단 항목 | 막히는 작업 |
|---|---|---|
| B1 | **크림 바탕 hex** (값 없음) | 배경 토큰 — 전 화면 |
| B2 | **`primaryPressed` · `primaryDark` 파생 공식** | 버튼 눌림·대비 — 전 CTA |
| B3 | **탭 구성** (검색 탭 유지 vs 라운지 탭 도입) | 네비게이션 골격 |
| B4 | **영역 이름** (웨딩일정 / 웨딩노트 / 웨딩플랜) | 문구·탭 라벨 |
| B5 | **Pretendard 폰트 파일** (대표님 제공 예정) | 서체 반입 |

아래는 2단계를 막지는 않으나 3단계 전에 정해져야 한다: 테라코타 역할(D4) · 스킨 6종과 `#E7898D`(D5) · radius 18px 채택(D9) · 앱 아이콘 코랄 고정(D8).

### 2-2. 작업 — 순서대로

| 순 | 작업 | 대상 파일 | 비고 |
|---|---|---|---|
| 1 | 토큰 값 교체 | `spec/tokens.json` | `color.brand.primary` → `#E7898D`, `color.brand.accent` 신설, `typography.$fontFamily` → Pretendard. **각 값에 `$note`로 출처(파일:줄)를 적는다** |
| 2 | 토큰 사본 동기화 | `packages/ui/src/theme.ts` | 손으로 맞춘다. **1과 2의 값이 어긋나면 2단계는 실패다** |
| 3 | 생성물 재생성 | `node gen-tokens.js web/ios/android` | 손으로 옮기지 않는다 |
| 4 | 토큰을 우회하는 하드코딩 제거 | `packages/ui/src/wedding-mark.tsx:38` | 기본 인자를 토큰 참조로 바꾼다 |
| 5 | 서체 반입 | `apps/mobile/assets` · `packages/ui/src/typography.ts` · `packages/ui/src/tokens.css` | B5 선행. 폰트 파일이 없으면 **여기서 멈추고 보고한다.** 없는 폰트를 적으면 조용히 시스템 서체로 떨어진다 |
| 6 | 공용 컴포넌트 확인 | `packages/ui/src/` 36파일 | **새로 만들지 않는다.** 기존 것이 새 토큰에서 제대로 보이는지만 확인. 특히 `status-view` · `list-skeleton` · `category-cycle-loader` · `data-tier-badge` · `verification-badge` |
| 7 | 네비게이션 | `apps/mobile/src/app/(tabs)/_layout.tsx` · `features/navigation/tab-bar.tsx` | B3 선행. **URL·라우트 경로는 바꾸지 않는다**(대표 문서 §9). 바뀌는 것은 라벨뿐 |
| 8 | 인증 | `src/app/login/*` · `features/auth` | 카카오+이메일 정본 유지. 애플(D6)은 판단 대기이므로 **손대지 않는다** |

### 2-3. 2단계 완료 판정

전부 만족해야 완료다. 하나라도 미달이면 완료가 아니다.

- [ ] `spec/tokens.json`과 `packages/ui/src/theme.ts`의 brand 색이 **값 단위로 일치**한다 (`#E7898D` · `#ECA0A3`)
- [ ] 새로 넣은 모든 토큰 값에 `$note`가 있고, 출처가 **파일명과 줄 번호**로 적혀 있다
- [ ] `grep -rin "ff6f61" apps/mobile/src packages/ui/src | grep -v /admin/` 결과가 **0건**이다
- [ ] `npm run typecheck` 통과
- [ ] `npm run lint` 통과
- [ ] `npm run test` 통과 — 특히 `apps/api/src/test/typography.test.ts`(표 밖 글자 크기 차단)
- [ ] `node lint-copy.js`가 통과한다 (`spec/glossary.json` 금지어)
- [ ] **화면 파일(`apps/mobile/src/app/**`)의 diff가 0줄**이다 — 네비게이션 `_layout.tsx`와 인증 화면만 예외
- [ ] 앱이 기동하고 5탭이 모두 열린다
- [ ] 서체가 Pretendard로 **실제 렌더된다**(폰트 파일 미반입이면 이 항목은 `UNVERIFIED`이고 2단계는 미완료다)

## 3. 3단계 — 화면 구현

### 3-1. 범위

`RN_MIGRATION_MAP.md`의 **ADAPT 13화면**만 착수한다.

우선순위는 사용자 노출 빈도 순:
1. 홈 → 2. 검색 → 3. 업체 상세 → 4. Pick 목록 → 5. Pick 비교 → 6. MY
7. 웨딩노트(캘린더·예산) → 8. 라운지(웨딩피드·박람회) → 9. 라운지 상세
10. 로그인 → 11. 온보딩 → 12. 계약 인증

**REUSE 약 65화면은 착수하지 않는다.** 2단계 토큰 교체로 따라온다. 3단계 끝에 육안 확인만 한다.

### 3-2. 착수하지 않는 것 — 명시

| 항목 | 이유 |
|---|---|
| 상담 신청 (`ConsultPage`) | 업체 예약 API 계약이 없다. 신설은 범위 밖 |
| 후기 상세 + 댓글 | 상세 라우트·댓글 계약이 없다 |
| 라운지 리얼후기 (전역 후기 피드) | 전역 후기 목록 API가 없다. **API가 생기기 전에는 착수하지 않는다** |
| 웨딩노트 상담기록 탭 | 새 기능. 대표 문서 §6이 만들지 말라고 적었다 |
| 애플 로그인 | 인증 정책 변경 |
| 관리자 콘솔 27화면 | 범위 밖 |
| 히어로 테마 전환 · 영문 eyebrow · C등급 8파일 | 프로토타입 잔재 (REMOVE) |

### 3-3. 3단계 작업 규칙

- **API 계약을 바꾸지 않는다.** DB 스키마·마이그레이션도 범위 밖이다. 화면이 새 데이터를 원하면 착수하지 말고 보고한다
- **라우트 경로를 바꾸지 않는다.** 라벨만 바꾼다 (대표 문서 §9)
- **상태(로딩·빈·오류)는 Figma에서 가져오지 않는다.** Figma 시안에 상태가 거의 없다. `spec/screens.json` `stateSets`와 기존 `packages/ui` 컴포넌트를 쓴다
- **문구는 `spec/strings.ko.json`에서만 가져온다.** Figma의 한국어 문구를 그대로 옮기지 않는다
- **Figma B등급의 수치를 시안 값으로 믿지 않는다.** 여백·크기는 `spec/tokens.json`을 따른다
- 화면 하나를 끝낼 때마다 typecheck·lint·test를 돌린다. 12화면을 몰아서 검증하지 않는다
- **개편 중 사용자가 중간 상태를 보는 것은 무방하다**(2026-09-14 대표 확정 ④). 따라서 feature flag나 일괄 전환을 만들지 않는다 — 화면 단위로 순차 반영한다

### 3-4. 3단계 완료 판정

- [ ] ADAPT 13화면이 모두 반영됐다
- [ ] 각 화면에 `stateSets`의 로딩·빈·오류 상태가 **실제로 동작한다**(코드만 있는 것이 아니라 확인됨)
- [ ] `npm run typecheck` · `npm run lint` · `npm run test` 전부 통과
- [ ] `node lint-copy.js` 통과 — 특히 `AI` · `탐색` · `확인된 제보` · `데이터` 잔존 0
- [ ] `grep -rn "AI\|탐색" apps/mobile/src/app --include=*.tsx | grep -v admin` 결과를 검토했고 사용자 노출 문자열에 잔존이 없다
- [ ] Pick Mark가 SEED 하트 아이콘으로 대체되지 않았다 (`tokens.json` `symbol` 확정본 유지)
- [ ] API 계약(`packages/api-contract/`) diff가 **0줄**이다
- [ ] DB 스키마(`packages/db/`) diff가 **0줄**이다
- [ ] 라우트 경로 diff가 0줄이다 (파일 이동·이름 변경 없음)
- [ ] REUSE 약 65화면을 육안 확인했고 깨진 화면 목록이 비어 있다

## 4. 4단계 — 검증 (개요)

- 전체 `typecheck` · `lint` · `test` · `expo export --platform web`
- 디바이스 실기 확인: iOS 노치 · Android 3버튼(inset 0으로 오는 문제, `tokens.json` `safeArea.reference.androidThreeButton`)
- 접근성: 사진 위 글자 대비 4.5:1 (`image.$overlayRule`)
- 심사 필수 5화면 동작 확인: 회원탈퇴 · 연령 확인 · 약관 · 개인정보처리방침 · 배우자 연결

## 5. 5단계 — 릴리스 (개요)

범위 밖. 배포·태깅은 **대표님 승인 없이 실행하지 않는다.**

## 6. 위험

| 위험 | 영향 | 대응 |
|---|---|---|
| **토큰 사본 2개가 어긋난다** | 화면마다 다른 색. 발견이 늦다 | 2단계 완료 판정에 값 단위 일치 확인을 넣었다. 장기적으로 `theme.ts`도 `gen-tokens.js`가 생성하게 만드는 것이 옳다 (별도 과제) |
| **Pretendard 파일이 안 온다** | 조용히 시스템 서체로 떨어져 아무도 모른다 | 2단계 5번에서 멈추고 보고한다. `UNVERIFIED`를 완료로 적지 않는다 |
| **크림 바탕을 임의로 정한다** | 전 화면을 두 번 고친다 | B1을 블로커로 걸었다 |
| **「자료가 두 벌」 사고** | 폐기된 시안 위에 쌓는다 (`CLAUDE.md`에 전례) | 층 원칙 + Figma C등급 8파일 참조 금지 + Figma는 읽기 전용 클론 |
| **Figma B등급 수치를 시안 값으로 믿는다** | 근거 없는 여백·크기가 퍼진다 | 3단계 규칙에 명시. `rounded-2xl` 52곳이 실제로는 의도보다 작게 렌더된다는 실측 사례를 `FIGMA_DESIGN_SYSTEM.md` §3-1에 남겼다 |
| **UNMAPPED를 「일단 만들어 본다」** | API 계약 신설로 번진다 | 3-2에 착수하지 않을 것을 명시했다 |

---
1단계 산출물 4개: `FIGMA_SCREEN_INVENTORY.md` · `FIGMA_DESIGN_SYSTEM.md` · `RN_MIGRATION_MAP.md` · `RN_MIGRATION_PLAN.md`
