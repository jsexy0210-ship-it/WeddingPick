# After — claude/rn-preview (tokens + components + nav-auth + screens-vendor + screens-core 머지) — 2026-09-14

`claude/rn-screens-plan`은 아직 못 들어갔다(충돌 — MASTER에 별도 보고). 나머지 5개
브랜치는 전부 들어갔다. **이번에 처음으로 색·서체가 바뀐 것이 보인다.**

## 가장 큰 변화 — 색·서체(대표님이 가장 궁금해하실 것)

- **키 컬러가 코랄 `#FF6F61` → 더스티 로즈 `#E7898D`로 바뀌었다.** 홈의 "웨딩픽 추천"
  글자·D-day·선택된 칩 테두리, MY의 아바타 배경, 하단 탭 Pick 아이콘 등 전부 이 색이다.
- **서체가 Pretendard 단일로 바뀌었다.** 시스템 서체 대비 글자가 더 둥글고 통일된
  느낌이다(가장 잘 보이는 자리: 홈의 큰 제목 "웨딩홀부터 정해볼까요?").
- Primary 버튼 위 글자는 흰색이 아니라 **플럼 `#371B34`**다(대비 문제로 2026-09-14
  대표님이 확정 — WCAG AA 6.11:1).

## 그다음 — 네비게이션(직전 보고와 동일, 유지됨)

- 하단 탭: 홈 · **웨딩노트** · Pick · **라운지** · MY (검색 탭은 빠지고 홈 상단 검색바로
  이동 — **대표님 의도대로**, 초기 이미지 데이터 부족으로 임시 후퇴. 차후 탭 복귀 예정)
- **홈 화면 최상단에 검색바가 새로 생겼다**(`01-home.png` 참고) — 검색 탭이 빠진 자리를
  메운다.
- 라운지는 실제 탭으로 존재하고 서버가 없어 locked-empty 상태(`09-lounge.png`).

## 찍은 화면 — 11장

| 파일 | 화면 |
| --- | --- |
| `01-home.png` | 홈 — 새 색·서체·홈 검색바 전부 보임 |
| `02-search.png` | 검색(경로 직접 접근) |
| `03-pick-list.png` | Pick 목록 |
| `04-pick-compare.png` | Pick 비교 |
| `05-wedding-plan.png` | 웨딩플랜(탭 라벨 「웨딩노트」) |
| `08-my.png` | MY — 아바타 배경 새 색 |
| `09-lounge.png` | 라운지(신규 탭) |
| `16-onboarding.png` | 온보딩 |
| `17-withdrawal.png` | 회원탈퇴 |
| `19-policies.png` | 약관 진입 |
| `20-spouse-connect.png` | 배우자 연결 |

## 통합 상태

머지됨: `claude/rn-tokens` · `claude/rn-components` · `claude/rn-nav-auth` ·
`claude/rn-screens-vendor` · `claude/rn-screens-core`.

`rn-tokens` 충돌(`theme.ts` · `spec/tokens.json` · `apps/web/src/site-styles.ts`)은
MASTER 판정대로 rn-tokens 쪽을 통째로 취해 풀었다. `rn-screens-core`의 유일한 충돌
(`docs/rn-migration/COMPONENT_PARITY.md` modify/delete)도 MASTER 판정대로
rn-screens-core의 삭제를 따랐다(파일 제거).

`claude/rn-screens-plan`은 새로 충돌 — `my/index.tsx`·`wedding/[id]/complete.tsx`·
`terms.ts`(값은 같고 구현 방식만 다름, 아래 참고)·`apps/web/src/styles.ts`(코랄 파생값
재충돌)·`weddingpick-og.png`/`.svg`(바이너리)·`scripts/gen-icons.js`(modify/delete).
MASTER에 상세 보고 후 대기 중.

매 머지 뒤 `npm run typecheck`와 `npm run export:web --workspace @weddingpick/mobile`
둘 다 통과 확인 후에만 푸시했다.
