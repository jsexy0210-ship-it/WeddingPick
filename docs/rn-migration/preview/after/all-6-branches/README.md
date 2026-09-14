# After — claude/rn-preview (6개 브랜치 전부 머지: tokens + components + nav-auth + screens-vendor + screens-core + screens-plan) — 2026-09-14

`claude/rn-screens-plan`까지 머지 완료(커밋 `82fd500d`). MASTER가 판정한 6건 충돌
전부 판정대로 처리했다(아래 「머지·충돌 처리」 참고). 매 머지 뒤 `npm run typecheck`와
`npm run export:web --workspace @weddingpick/mobile` 둘 다 통과 확인 후에만 푸시했다 —
이번 푸시도 같다.

## 웨딩노트 · MY · 라운지 — 화면으로는 차이 없음(정직하게 보고)

MASTER는 `rn-screens-plan`이 들어가면 이 세 화면이 바뀐다고 봤다. 다시 찍어 직전 After
세트(`../tokens+components+nav-auth+screens-vendor+screens-core/`)와 픽셀 단위로 대조했는데
`05-wedding-plan.png`·`08-my.png`·`09-lounge.png` 전부 **동일하다.**

이유: 이번에 실제로 판정·적용한 두 코드 변경(`apps/mobile/src/app/(tabs)/my/index.tsx`의
`loginHint` 문구, `apps/mobile/src/app/(tabs)/wedding/[id]/complete.tsx`의 `NavBar` 제목)이
캡처 도구가 찍는 11개 경로의 **지금 상태**에는 안 걸린다 — `loginHint`는 로그아웃 상태에서만
보이고(지금 캡처는 로그인 상태 fixture), `wedding/[id]/complete`는애초에 캡처 경로 목록에
없다(동적 `[id]` 세그먼트라 정적 export에 대응하는 파일이 없다 — 이전 세션들과 같은 제약).
**찍은 걸 못 찍었다고 하지 않고, 안 바뀐 걸 바뀌었다고도 안 한다.**

## 색·서체(직전 보고와 동일, 유지됨)

- 키 컬러 더스티 로즈 `#E7898D`, Primary 버튼 위 플럼 `#371B34`, Pretendard 단일 서체 — 전부 그대로 유지.

## 찍은 화면 — 11장

| 파일 | 화면 | 비고 |
| --- | --- | --- |
| `01-home.png` | 홈 | |
| `02-search.png` | 검색 | |
| `03-pick-list.png` | Pick 목록 | |
| `04-pick-compare.png` | Pick 비교 | |
| `05-wedding-plan.png` | 웨딩플랜(웨딩노트) | 직전 After와 동일 |
| `08-my.png` | MY | 직전 After와 동일 |
| `09-lounge.png` | 라운지 | 직전 After와 동일 |
| `16-onboarding.png` | 온보딩 | |
| `17-withdrawal.png` | 회원탈퇴 | |
| `19-policies.png` | 약관 진입 | |
| `20-spouse-connect.png` | 배우자 연결 | **에러 화면**(fixture 없음, 직전 After와 동일 — 회귀 아님, 기존 상태) |

## 머지·충돌 처리 — `claude/rn-screens-plan`, MASTER 판정대로 적용

- `apps/mobile/src/app/(tabs)/my/index.tsx` — `--theirs`(rn-screens-plan). `loginHint: ` 웨딩노트 `와 Pick 인증에 필요해요``
- `apps/mobile/src/app/(tabs)/wedding/[id]/complete.tsx` — `--theirs`(rn-screens-plan). `<NavBar title={TERMS.ourWedding} />`
- `packages/domain/src/terms.ts` — `--ours`(HEAD). 값은 동일(`ourWedding: '웨딩노트'`), 주석만 차이
- `apps/web/src/styles.ts` — `--ours`(HEAD). `--coral-dark: #c63f45` 유지(`coralPressed` `#d87d80`와는 별개 값 — MASTER 정정)
- `apps/web/public/assets/weddingpick-og.png`·`.svg` — `--ours`(HEAD, rn-tokens 쪽 최신본 유지)
- `scripts/gen-icons.js` — `git rm`(삭제 유지, `main`에도 없음 확인됨)

## 통합 상태

머지됨: `claude/rn-tokens` · `claude/rn-components` · `claude/rn-nav-auth` ·
`claude/rn-screens-vendor` · `claude/rn-screens-core` · `claude/rn-screens-plan`(전부).

`claude/rn-screens-vendor`가 rn-tokens를 다시 반영한 새 커밋을 내면 그때 재머지 예정(대기 중).
