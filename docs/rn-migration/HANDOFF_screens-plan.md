# 인계 — 웨딩노트·MY·라운지

브랜치 `claude/rn-screens-plan` · 작성 2026-09-14 KST · 동결 지시(MASTER)로 여기서 멈춤.

## 대조표

```
웨딩노트 3탭   OurWedding.tsx (캘린더·상담기록·예산현황)  ↔  (tabs)/wedding/**   — 대조 완료(구성만, B등급)
MY            My.tsx                                    ↔  (tabs)/my/**       — 대조 완료(구성만, B등급)
라운지 3탭     FlowScreens.tsx (리얼후기·웨딩피드·박람회)  ↔  (tabs)/community/** — 대조 완료(구성만, B등급)
```

세 곳 다 코드 대조는 끝났다(PR #227 `FIGMA_SCREEN_INVENTORY.md`가 더 정밀하다 — 이 문서와 같이 본다).
값(px·색·문구)은 대조하지 않았다 — B등급이라 안 가져온다.

## 한 것

- **웨딩노트 라벨** 「웨딩일정」→「웨딩노트」. `packages/domain/src/terms.ts` `TERMS.ourWedding` 한 곳만
  고쳤고, 하드코딩돼 있던 `wedding/[id]/complete.tsx`·`my/index.tsx` 참조 2곳도 상수로 옮겼다. 경로는
  그대로(`(tabs)/wedding`).
- **토큰 3파일 정합성 복구**: `spec/tokens.json` · `packages/ui/src/theme.ts` · `apps/web/src/site-styles.ts`를
  `claude/rn-tokens` 최신판(main 구조 보존판)으로 교체. 확인: 1502줄/973줄 · `primary #E7898D` ·
  `onTint #371b34` · `npm run typecheck --workspaces` 전부 초록.
- **라운지 3탭 뼈대** — `(tabs)/community/index.tsx`(리얼후기·웨딩피드·박람회, `SegmentedTabs`) +
  `(tabs)/community/feed/[id].tsx`(상세 자리). `spec/strings.ko.json`에 `community.*` 문구 추가.
  박람회 탭은 콘텐츠를 새로 안 만들고 기존 `WP-EXPO-001`(`/search/expo`, 검색 세션 담당)로 보낸다.
- **MY** — 코드 변경 없음. 현재 구현이 이미 정본(`WP-MY-001~010`)과 구조가 맞아 재단장 대상이
  「값(토큰)」뿐이라고 판단했으나 실제 적용 검증은 못 했다(아래 「하다 만 것」).

## 하다 만 것

- **웨딩노트 캘린더·예산현황 탭** — 기존 구현(`wedding/index.tsx` · `events/*` · `expenses/*`)이 스펙과
  이미 맞는다고 코드로 확인만 했다. **새 토큰(#E7898D 등)을 입은 실제 화면을 실행해서 본 적은 없다**
  (빌드·스크린샷 미실행).
- **라운지** — `/community` 탭 자체는 `_layout.tsx`(네비인증 담당)에 아직 안 걸려 있어 탭바에서
  못 들어간다. 화면 파일만 존재한다.
- **MY** — 위와 같음. 새 토큰 적용 후 실제 화면 검증 안 함.

## 손도 못 댄 것

- **웨딩노트 상담기록 탭**(음성 업로드 → AI 분석 → 포함/추가비용/조건 정리). 대표님 문서 §6:
  「미구현이면 새 기능으로 안 만든다」— 그대로 미구현 상태로 둔다. `AI 분석 중`·`AI 분석이 완료됐어요`·
  `AI가 상담 내용을 정리했어요` 3곳은 전부 이 탭 안에 있고, 탭을 안 만들었으니 고칠 자리도 없다.
- **라운지 상세 실제 콘텐츠** — 서버 계약이 없어 빈 자리(「게시물을 찾을 수 없어요」)만 있다.
- **스크린샷 대조** — `node scripts/screenshot-screens.mjs`를 한 번도 안 돌렸다. 코드와 시안을
  눈으로만 비교한 것은 CLAUDE.md 기준 「본 것」이 아니다.

## 함정

- **`claude/rn-tokens`·`claude/rn-components`는 세션 도중에도 계속 갱신됐다.** 병합 시점에 다시
  `git fetch`하지 않으면 낡은 값(구 코랄 `#FF6F61`, `Border`/`Elevation`/`AdminSpacing` 등 삭제된 키)이
  섞여 `tsc`가 80곳 넘게 깨진다. 최신 tip으로 재병합해야 한다 — 이번에 실제로 한 번 겪었다.
- **`claude/rn-screens-core`·`claude/rn-nav-auth`는 main 대비 수백~수천 줄 벌어진 낡은 base다**
  (172커밋 전 시점 — MASTER 확인). 병합하면 main을 대규모로 퇴행시킨다. **병합 금지.**
- **Figma 저장소에서 실제로 라우팅되는 파일은 8개뿐**(`src/app/routes.ts` 기준): `Root` `Home` `Search`
  `Pick` `OurWedding` `My` `FlowScreens` `VendorFlows`. `Community.tsx`를 포함한 나머지 8개는 죽은
  파일이다 — 처음엔 이걸 몰라서 9장을 전부 담당인 줄 알고 시간을 썼다.
- **jest 1건 실패 중**: `depth-back.test.ts`의 `ROUTES`가 `/community`·`/community/feed/[id]`를 모른다.
  `depth-back-rules.ts`는 네비인증 세션 전담이라 여기서 못 고친다 — 그쪽이 등록해야 한다.
- **MY·라운지 전 화면에 Figma는 로딩·빈·오류 상태를 안 그렸다**(프로토타입 특성). 없어도 된다는
  뜻이 아니다 — 기존 `packages/ui/src/status-view.tsx` 등을 재사용한다.
- **`spec/tokens.json`·`packages/ui/src/theme.ts`·`apps/web/src/site-styles.ts`는 토큰 세션 전담**이고,
  `packages/ui/src/*.tsx`는 컴포넌트 세션 전담이다. 둘 다 이번 작업에서 직접 고치지 않았다(충돌
  해결로 `checkout --theirs`만 했다).
