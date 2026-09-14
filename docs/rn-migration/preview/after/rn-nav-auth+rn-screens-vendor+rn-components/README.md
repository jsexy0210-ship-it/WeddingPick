# After — claude/rn-preview (rn-components + rn-nav-auth + rn-screens-vendor 머지) — 2026-09-14

`claude/rn-tokens`는 **아직 안 들어갔다**(충돌 — 별도 보고). 그래서 색·서체는 아직
before와 같다(코랄 `#FF6F61`, 시스템 서체). 이번 After에서 눈에 띄는 것은 **전부
네비게이션 구조 변화**다.

## 가장 눈에 띄는 변화 — 하단 탭 구성이 바뀌었다

| Before | After |
| --- | --- |
| 홈 · 검색 · Pick · 웨딩일정 · MY | 홈 · **웨딩노트** · Pick · **라운지** · MY |

**「검색」 탭이 탭 바에서 빠졌다.** 경로(`/(tabs)/search/`)는 아직 살아 있어 직접 찍을
수는 있지만(`02-search.png`), 하단 탭에서 바로 안 보인다 — 검색으로 가는 길이 바뀐
것으로 보인다(홈 안의 다른 진입점일 수 있음, 확인 필요).

**「라운지」 탭이 새로 생겼다.** `docs/rn-migration/preview/before/README.md`에 "라운지
기능이 저장소에 아예 없다"고 적었던 것은 그 시점(main 기준) 얘기였고, `rn-nav-auth`가
`apps/mobile/src/app/(tabs)/community/` 라우트로 실제로 추가했다. 지금은 "조회만" 잠금
상태(`09-lounge.png`) — 「이야기를 모으고 있어요 / 열리면 알려드릴게요」로 정상
locked-empty 화면이 뜬다. 서버가 없어 잠근다는 MASTER 설명과 정확히 일치한다.

「웨딩일정」 탭 라벨이 「웨딩노트」로 바뀌었다 — 같은 화면(`/(tabs)/wedding/`)으로 보인다
(`05-wedding-plan.png`가 before와 레이아웃 동일).

## 찍은 화면 — 6장 (전체 21장 아님, 우선 눈에 띄는 것만)

| 파일 | 화면 | before 대비 |
| --- | --- | --- |
| `01-home.png` | 홈 | 하단 탭 바뀜. 본문은 동일 |
| `02-search.png` | 검색(경로 직접 접근) | 카드·레이아웃 동일. 탭에서만 빠짐 |
| `03-pick-list.png` | Pick 목록 | 동일 |
| `05-wedding-plan.png` | 웨딩플랜(탭 라벨 「웨딩노트」) | 동일 |
| `08-my.png` | MY | 동일 |
| `09-lounge.png` | 라운지(신규 탭) | **새 화면** — locked-empty |

## 통합 상태

머지됨: `claude/rn-components` · `claude/rn-nav-auth` · `claude/rn-screens-vendor`(nav-auth와
내용이 같아 "Already up to date"로 자동 합류).
막힘: `claude/rn-tokens`(theme.ts·tokens.json 충돌), `claude/rn-screens-core`(COMPONENT_PARITY.md
modify/delete 충돌), `claude/rn-screens-plan`(nav-auth와 겹쳐 새로 충돌 발생 — my/index.tsx ·
wedding/[id]/complete.tsx · site-styles.ts · terms.ts · theme.ts · tokens.json).

빌드·typecheck 전부 통과 확인 후 커밋·푸시했다(브랜치 `claude/rn-preview`).
