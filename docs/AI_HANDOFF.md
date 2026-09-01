# WeddingPick AI HANDOFF

## 기준
- updated_at: 2026-09-01T00:15Z
- author_ai: Claude Opus 5 — 세션 «프론트엔드» (`session_01HTGSU2B4vFjePXFS2ajKBY`)
- repository: WeddingPickl
- branch: `claude/home-c1`
- base_commit: `9b4db6d` (분기 시점의 main · claude/session-a4bq31)
- last_verified_commit: `6bf0abd` (origin/main `fc6c199` 병합 후, 타입체크·테스트 통과)
- policy_version: v3.10 (`docs/통합정책 v3.10`)

## 이번 작업 범위
- work_scope: Claude Design 핸드오프 `웨딩픽 홈 C-1 상태.dc.html`을 실제 앱으로 구현.
  홈 화면 재작성 + 디자인 토큰을 TDS에서 SEED로 이관.
  사용자가 넷 다 «추천» 선택지로 확정: ① weddingpickl 앱에 구현 ② 기존 API로 최대한 연결
  ③ 홈 편집을 C-1 고정 순서로 대체 ④ theme.ts를 SEED로 교체.

## 완료
- completed:
  - **홈 C-1 6상태.** 시안 여섯 장을 레이아웃 다섯(`guest`·`taste`·`empty`·`picking`·`decided`)과
    `comparable` 한 값으로 되살림. 대응표는 `apps/mobile/src/features/home/state.ts` 상단 주석에 표로 있음.
  - **토큰 SEED 이관.** gray 램프·의미색·타이포 래더(32/26/20/18/16/14, 135%/150%, 자간 0)·
    라디우스(버튼 6 · 카드 10 · 시트 20). **semibold 삭제** — SEED는 400/700뿐이라 t5의 600이 700으로 올라감.
    어두운 모드도 SEED가 정한 dark 램프로 교체(이전에는 우리가 지어낸 값이었음).
  - **ActionButton 확장.** `variant: 'ghost'`와 `size: 'auto'|'medium'|'large'|'xlarge'` 추가.
    기본값 `auto`는 기존 동작 그대로라 34곳의 기존 호출부는 바뀌지 않음.
  - **홈 편집 진입점 제거.** `home-edit.tsx` 파일과 `_layout.tsx` 등록은 남기고 홈에서 가는 길만 없앰.
  - **HomeSkeleton 재작성.** 옛 홈 골격(금액·분포바·범례)을 그리고 있어서 C-1 골격으로 맞춤.
  - **용어 오류 1건 수정.** `NOT_ENOUGH_DATA`가 `아직 데이터가 적어요`였음.
    v3.3이 사용자 화면에서 «데이터»를 걷어냈는데 이 문구만 남아 있었고 홈이 그것을 그림 → `아직 정보가 적어요`.

## 변경 파일
- changed_files:
  - `apps/mobile/src/app/(tabs)/index.tsx` — 전면 재작성
  - `apps/mobile/src/features/home/` — 신규 9개: `state.ts` `state.test.ts` `taste.ts` `taste.test.ts`
    `board.tsx` `todays-pick.tsx` `vendor-list.tsx` `taste-picker.tsx` `category-image.tsx`
    `content.ts` `wedding-content.tsx` / 수정: `home-skeleton.tsx`
  - `packages/ui/src/theme.ts` `themed-text.tsx` `action-button.tsx`
  - `packages/domain/src/terms.ts` + 문자열을 단언하던 테스트 3개
    (`disclosure.test.ts` `nudge.test.ts` `apps/api/src/test/vendors.test.ts`)

## DB / Migration 변경
- schema_or_migration_changes: 없음. 마이그레이션·계약(`api-contract`)·API 라우트를 하나도 건드리지 않음.

## 테스트
- tests_run: `npm run typecheck` · `npm test` · `npm run lint` · `npx expo export --platform web`
- test_results: 타입체크 6개 워크스페이스 전부 통과 / 도메인 401 · 모바일 45 · 계약 17 · 웹 13 통과 /
  린트 0 / 웹 번들 빌드 성공.
  **API 406건과 DB 65건은 `DATABASE_URL`이 없어 건너뜀 — 이 환경에서는 검증 전.**

## 알려진 이슈
- known_issues:
  - **토큰 교체의 파급.** theme.ts·themed-text.tsx는 앱 전체가 쓴다. 기존 40여 화면의 글자 크기와
    굵기가 같이 바뀐다(15→16, 17→18, 13→14, semibold→bold). 의도된 이관이지만
    **홈 외의 화면은 눈으로 확인하지 않았다.** 시각 회귀 점검이 필요하다.
  - `Radius.medium` 16→10, `Radius.card` 20→10으로 내려갔다. 카드가 눈에 띄게 각져진다.
  - 글꼴은 **Pretendard를 유지**했다. 핸드오프의 «시스템 서체»는 TDS 라이선스 때문에 나온 말이고
    Pretendard에는 그 문제가 없다. CLAUDE.md의 «Pretendard 미적용»과 어긋나는 유일한 지점이고,
    되돌리려면 `packages/ui/src/theme.ts`의 `SANS_STACK` 한 줄만 고치면 된다.

## 미완료
- incomplete_tasks:
  - **취향(taste)이 기기 저장이다.** 계약에도 도메인에도 취향 개념이 없어 AsyncStorage에 둔다.
    새 기기에서는 다시 묻는다. 서버에 자리가 생기면 `features/home/taste.ts`의
    `loadTaste`/`saveTaste` 두 함수만 API 호출로 바꾸면 화면은 그대로다.
  - **웨딩 정보 콘텐츠 API가 없다.** `features/home/content.ts`의 `listWeddingContent()`가
    빈 배열을 돌려주고 홈이 섹션째 접는다. 컴포넌트(`wedding-content.tsx`)는 시안대로 다 그려져 있다.
    시안의 제목을 하드코딩하지 않은 이유: 앱에서는 그것이 눌러도 아무것도 없는 «읽을 수 있는 글»로 보인다.
  - **업체 사진 필드가 계약에 없다.** `vendorSummarySchema`에 이미지 URL이 없어
    `category-image.tsx`가 늘 조용한 면을 그린다. 빈 상자나 «사진 준비 중»은 노출하지 않는다(시안 규칙).
    필드가 생기면 `uri`만 넘기면 된다.
  - **비회원 홈의 업종별 «확인된 정보 N건»을 적지 않았다.** 그 숫자를 낼 API가 없다.
    근거 없는 숫자를 화면에 올리지 않는다(`conventions.md`).
  - **오늘의 Pick의 개인화 추천 이유 한 줄**(시안: «고른 사진 톤에 가깝고 5월 주말이 열려 있어요»)을
    적지 않았다. 계산할 근거가 없다.

## 다음 우선순위
- next_priority:
  1. 이 브랜치를 `claude/session-a4bq31`에 병합할지 결정. 병합하면 앱 전체 타이포가 SEED로 바뀐다.
  2. 토큰 이관 후 **홈 외 화면 시각 회귀 점검** — 가장 큰 위험이 여기 있다.
  3. 검색 · Pick · 업체상세 — 시안은 다 나왔고 라우트가 얕다. 홈에서 이어지는 핵심 루프다.
  4. 관리자 콘솔 웹 UI — IA 24화면이 통째로 비어 있고 지금은 CLI 스크립트 10개로만 돈다.

## 변경 금지 / 주의
- do_not_change:
  - **Pick 심볼**(하트 안 체크). CLAUDE.md가 두 path를 고정값으로 박아뒀고,
    백엔드 세션이 `fc6c199`에서 앱 아이콘 5종·스플래시까지 적용을 끝냈다.
  - **키 컬러 코랄 `#ff6f61`과 거터 24px.** SEED와 다른 채로 두는 것이 확정이다. 이탈은 이 둘뿐이다.
  - **사용자 화면 금칙어**: `AI` · `데이터` · 애매모호 표현(`거의`·`대략`·`어느 정도` 등).
    `packages/domain/src/copy-rules.ts`와 `terms.ts`가 대체어를 들고 있다.
  - **가격 공개 4단계 사다리**(`disclosure.ts`)가 금액을 공개하는 유일한 기준이다.
    화면마다 «몇 건부터 보여줄까»를 다시 정하지 않는다.

## 롤백
- rollback_note:
  `git revert 6ed3106` 하나면 홈과 토큰이 함께 되돌아간다(병합 커밋 `6bf0abd`는 백엔드 작업이라 남긴다).
  토큰만 되돌리려면 `packages/ui/src/theme.ts`·`themed-text.tsx`·`action-button.tsx` 세 파일만
  `9b4db6d` 시점으로 체크아웃하면 되지만, 그러면 홈이 TDS 값으로 그려져 C-1과 어긋난다.

---

## 세션 분담 (2026-09-01 기준)

한 사람이 세션 셋을 동시에 돌리고 있어 무엇을 누가 들고 있는지 여기 적어 둔다.

| 세션 | ID | 소유 영역 | 브랜치 |
|---|---|---|---|
| **백엔드** | `session_01SLgCn4pWaQCTyYPzVLcbQr` | 레포 전체 · API · 심볼/아이콘 · 다음은 지연 로그인+최소 온보딩 | `claude/session-a4bq31` |
| 프론트엔드 | `session_01HTGSU2B4vFjePXFS2ajKBY` | 홈 C-1 · 디자인 토큰 (이 문서의 작성자) | `claude/home-c1` |
| 일일 공정률 브리핑 | `session_01GcqCiteAfxQ5X6SaHDhbDq` | **공정률 정의와 계산의 단일 출처** | `claude/daily-progress-briefing-3k7lez` |

**공정률 숫자는 브리핑 세션이 낸 것만 쓴다.** 프론트엔드 세션이 2026-09-01에 종합 58%
(앱 0.45 / 백엔드 0.3 / 관리자 0.15 / 디자인 0.1 가중)를 낸 적이 있으나, 그 가중치는
근거 없이 정한 값이라 **폐기한다.** 두 곳에서 숫자가 나오면 어느 쪽이 우리 숫자인지 알 수 없게 된다.

그때 함께 잰 **측정값**은 근거가 있으므로 브리핑 세션이 참고해도 된다
(`9b4db6d` 기준, `fc6c199` 미반영):
디자인 파일 18 · IA 고유 화면 ID 177 · 모바일 라우트 41 · API 핸들러 81(계약 76) ·
DB 마이그레이션 44 · 도메인 모듈 47/테스트 35 · UI 컴포넌트 14 ·
관리자 웹 UI 0(CLI 스크립트 10) · 박람회 코드 0.
