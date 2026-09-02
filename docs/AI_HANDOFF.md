# WeddingPickl AI 인수인계서

> 이 파일은 모든 Claude 세션이 읽는 **단일 진실 소스**다.
> 새 세션이 시작되면 이 파일을 먼저 읽어라. 작업이 끝나면 이 파일을 업데이트하고 커밋해라.

---

## 메타

- `updated_at`: 2026-09-02 (프론트엔드 세션, `claude/frontend-development-i1j2aa`)
- `repository`: jsexy0210-ship-it/WeddingPickl
- `branch (main)`: 4bae250
- `policy_version`: 통합정책 v3.13
- `dashboard`: https://claude.ai/code/artifact/a1307c11-f282-4cf2-a26d-e44bd083d7a9
- `ios_handoff_artifact`: https://claude.ai/code/artifact/b8792fcd-fefe-4386-b24e-41d122e90a87
- `screen_status_artifact`: https://claude.ai/code/artifact/b99277b7-3bdc-45dc-9614-a1310507df53

---

## 인프라 현황

### 서버
- **API 서버**: Fly.io — `weddingpickl.fly.dev`
- **DB**: Neon PostgreSQL (production)
- **스토리지**: Backblaze B2 (S3 호환)
- **모바일 빌드**: EAS (Expo Application Services) + GitHub Actions

### GitHub Actions 워크플로
| 파일 | 역할 |
|---|---|
| `main.yml` | PR 검증 · 테스트 |
| `release.yml` | iOS EAS 빌드 배포 |
| `db-migrate.yml` | Neon DB 마이그레이션 적용 |
| `fly-init.yml` | Fly.io 초기화 |
| `eas-init.yml` | EAS 프로젝트 초기화 |
| `storage-test.yml` | B2 스토리지 연결 테스트 |
| `android-apk.yml` | Android APK 빌드 |

---

## 🚨 사용자 직접 조치 필요 (Claude 불가)

### 0. 회원탈퇴 정책 — 최종 확정: 자동삭제 + 운영자 개입 (2026-09-02, 사용자 결정)
**상태**: 해결됨. main의 `release-gate.ts`/`withdrawalReady()` 게이트 방식은 채택하지
않는다.

사용자가 두 세션의 다른 구현(main의 정책 확정 전 기능 잠금 vs PR #10의 자동파기+
운영자 개입)을 확인한 뒤 직접 결정했다 — *"회원탈퇴 정책, 자동삭제+운영자개입 쪽으로
최종 확정할게."*

**확정된 구현**(PR #10, `claude/daily-progress-briefing-3k7lez`): 자동파기 유지 +
운영자 조회·HOLD·RESUME·RETRY·감사로그(`packages/domain/src/withdrawal.ts`,
`apps/api/src/withdrawal-admin.ts`, 마이그레이션 0055·0058).

**PR #10을 병합하는 세션이 할 일**:
- main의 `packages/domain/src/withdrawal.ts`(release-gate 버전)와
  `packages/domain/src/release-gate.ts`의 `withdrawalReady()` 의존을 걷어내고
  PR #10의 구현으로 교체(PR #10 자체는 이미 이렇게 병합해뒀다).
- `WITHDRAWAL_NOTICE`(§J-3)로 확정한 문구가 있다면 PR #10의 실제 탈퇴 화면 문구와
  맞는지 확인 — 서로 다른 문구가 화면에 남지 않게.
- `docs/통합정책 v3.13`에 이 결정(자동삭제 유지, release-gate 폐기)을 반영할지 확인.

### 1. iOS EAS 빌드 수정 — 최우선
**상태**: Release #1 ~ #10 전부 실패  
**근본 원인**: ASC API Key `62U8N2ZWJR`가 expo.dev에 미등록

**조치 방법**:
1. expo.dev → Account → Credentials → App Store Connect API Keys
2. Add New Key:
   - Key ID: `62U8N2ZWJR`
   - Issuer ID: `a7e4029d-6abf-4811-80a7-9cc47c1d1e21`
   - .p8 파일: `AuthKey_62U8N2ZWJR.p8` 업로드 (로컬에 보관 중)
3. 등록 완료 후 GitHub Actions → Release → Run workflow 실행

**참고**: 현재 expo.dev에는 `NPCMZ655GG`만 있으나 Team/Roles: None → 비활성 상태. `release.yml`은 `--clear-credentials` 제거 완료, 정상 상태.

### 2. Fly.io 환경변수 추가
```
flyctl secrets set OPERATOR_SESSION_TTL_DAYS=365 --app weddingpickl
```
(또는 Fly.io 대시보드 → weddingpickl → Secrets)

### 3. Production DB 마이그레이션 적용
```
# GitHub Actions → db-migrate.yml → Run workflow
# 또는 직접:
DATABASE_URL=<neon-connection-string> pnpm db:migrate
```
적용 대상: `0052_mission_draw.sql` (미션 완료 추적 + 월간 웨딩지원금 추첨 스키마)

**⚠️ 이 파일 그대로는 실행이 안 된다.** `ALTER TYPE reward_kind ADD VALUE 'monthly_draw'`를
같은 트랜잭션 안에서 바로 쓰는 CHECK 제약(`grant_source_matches_kind`)이 있어
Postgres가 "unsafe use of new value of enum type"으로 매번 실패한다(빈 DB에서
직접 재현·확인함). PR #10 브랜치에서 0052를 두 부분으로 나누고, 값을 더하는 것과
쓰는 것을 각각 새 마이그레이션(`0053_reward_kind_monthly_draw.sql`,
`0054_grant_source_matches_kind.sql`)으로 분리해 고쳤다 — main에 병합되지 않은
채로는 그대로 적용해도 실패한다.

### 4. 앱스토어 출시 블로커 — terms.url / privacy.url
`assertReleasable('production')`이 `terms.url` · `privacy.url` 미설정 시 throw → 앱스토어 출시 불가.  
URL 확정 후 도메인 상수(`packages/domain/src/constants/policy.ts` 또는 유사 위치) 업데이트 필요.  
`privacy.url`이 설정되면 `withdrawalReady() = true`로 릴리즈 게이트 자동 통과. 별도 코드 수정 불필요.

### 5. Gmail 커넥터 연결
Google 개발자 콘솔 알림 자동화 세션이 Gmail 미연결로 차단됨.  
claude.ai Settings → Connectors → Gmail 연결 필요.

---

## 세션별 작업 완료 현황

### 웨딩픽 통합 운영/관리 (session_01SLgCn4pWaQCTyYJaRa) — 아이들
**완료:**
- ✅ 월간 웨딩지원금 (§I-4) API + 모바일 화면 구현 → 원격 브랜치 푸시 완료
- ✅ 탈퇴 안내 문구 `WITHDRAWAL_NOTICE` 확정 (§J-3)
- ✅ `OPERATOR_SESSION_TTL_DAYS` 도메인 상수 추가 (코드에 추가됨, Fly.io 환경변수는 별도 조치 필요)
- ✅ `release.yml`에서 `--clear-credentials` 플래그 제거

### 정책 관리 (session_017L61fF1Tqbugm8WNCH6QG6, 이 세션) — 실행 중
**완료:**
- ✅ PR #9 머지: `0052_mission_draw.sql` — 미션 완료 추적 + 월간 웨딩지원금 추첨 스키마
- ✅ UX 정책 업데이트: J-3 탈퇴 화면, I-4 월간 웨딩지원금 (PR #8 포함)
- ✅ 개발 현황 대시보드 생성 (artifact a1307c11)

### 백엔드 관리 (session_01GcqCiteAfxQ5X6SaHDhbDq) — PR #10 병합 대기 (Sonnet 5)
**완료:**
- ✅ 최신 main(이 커밋 포함)을 브랜치에 병합, 충돌 21개 전부 해소
- ✅ 회원탈퇴 운영자 개입(조회·HOLD·RESUME·RETRY, `withdrawal-admin.ts`) +
  삭제 워커 트랜잭션 안전성(`FOR UPDATE`, 멱등) — 사용자 지시로 자동파기 유지 결정,
  아래 «회원탈퇴 정책 충돌» 참고
- ✅ 마이그레이션 0055~0058(회원탈퇴/AI라우터/이의만료/탈퇴관리자) — main의
  0052_mission_draw.sql 뒤로 재번호
- ✅ typecheck 7개 워크스페이스·lint 0 error·test 543개(API 기준, 전체 1537개) 전부 통과
  — CI와 동일한 명령(typecheck/lint/test/export:web/build)을 로컬에서 재현해 확인함
  (이 PR에서 GitHub Actions check-run이 뜨지 않아 — 원인 미확인 — 실제 워크플로 실행
  결과는 **미검증**)

**브랜치**: `claude/daily-progress-briefing-3k7lez` · **PR**: #10 (main ← 이 브랜치)
**미검증**: 실제 배포·health check(Fly.io 크리덴셜 필요, PR 단계에서는 원래도 실행 안 됨),
GitHub Actions 실제 실행 결과, production DB 적용.

### 프론트엔드 (session_01HTGSU2B4vFjePXFS2ajKBY) — 아카이브
**완료**: 모바일 앱 핵심 화면 구현, 42개 라우터 파일 생성

---

## 프론트엔드 화면 현황

### 기준: 핸드오프 전체 IA (176개 화면 코드)

| 상태 | 수 | 비율 |
|---|---|---|
| 구현됨 | 34 | 19% |
| 부분 구현 | 58 | 33% |
| 미구현 | 49 | 28% |
| 확인 필요 (Bottom Sheet·공통 상태) | 35 | 20% |

**라우터 파일**: `apps/mobile/src/app/` 42개 — 핵심 화면 커버

### 미구현 주요 영역

| 영역 | 미구현 수 | 비고 |
|---|---|---|
| 관리자 화면 (WP-ADM-*) | 25개 | 전부 미구현 |
| 박람회·웨딩 정보 (WP-EXPO-*) | 5개 | 전부 미구현 |
| 공통 Bottom Sheet (WP-SHT-*) | 16개 | 인라인 처리 여부 확인 필요 |
| 공통 상태 (WP-ST-*) | 14개 | 로딩/에러/빈 상태 확인 필요 |
| B2B 문의 (WP-BIZ-*) | 5개 | 소속확인·자료제공·혜택등록·광고·웹Footer |
| 커플 연결 (WP-CPL-*) | 2개 | 공동 편집 충돌, 변경 내역 |
| 우리웨딩 (WP-OUR-*) | 1개 | 일정 추가(신규 API 필요, 보류). 준비 타임라인(`/wedding/[id]/timeline`)·예식 완료(`/wedding/[id]/complete`) 둘 다 2026-09-02 구현, 새 백엔드 없이 기존 API로 만듦 |
| MY (WP-MY-*) | 0개 | 회원탈퇴(기존 구현 확인됨) · 취향 다시 고르기(2026-09-02 구현, `/my/preferences`) |
| 홈 (WP-HOME-*) | 1개 | TOP3 전체보기 — v3.10/C-1 재설계로 홈에서 뺀 섹션(의도적, 검색 탭으로 이동, 실제 미구현 아님, 2026-09-02 확인). 개인화 웨딩피드는 `WeddingContent`(`features/home/wedding-content.tsx` · `features/home/content.ts`)가 콘텐츠 목록은 보여주지만 취향·지역 등으로 걸러내는 개인화 로직은 없음(2026-09-02 확인, `content.ts`에 taste/region/filter 로직 없음) — 여전히 미구현 |
| 기타 | ~5개 | 지도 보기, 재실행·세션 복원, 진입 예외 등 |

상세 목록: https://claude.ai/code/artifact/b99277b7-3bdc-45dc-9614-a1310507df53

---

## DB 스키마 현황

### 마이그레이션 이력 (0001 ~ 0052, 전체 완료)

| 범위 | 내용 |
|---|---|
| 0001 ~ 0010 | 기반 인프라 (users, vendors, API keys 등) |
| 0011 ~ 0020 | 검색·매칭·견적 |
| 0021 ~ 0030 | 소셜·리뷰·알림 |
| 0031 ~ 0038 | Pick·비교·결제·광고 |
| 0039 ~ 0046 | 보상·제보·광고·결혼 지역 |
| 0047 ~ 0051 | 데이터 수집 파이프라인 (vendor_data_quality, change_log, import_run_log, vendor_images, corrections) |
| **0052** | **미션 완료 추적 + 월간 웨딩지원금 추첨** (미션 4종 + monthly_draws + draw_entries + draw_results + reward_grants 확장 + npay_deliveries) |

### ⚠️ 프로덕션 미적용
`0052_mission_draw.sql`은 코드 리포에 머지됐으나 Neon production DB에는 아직 미적용.  
`db-migrate.yml` 워크플로 실행 필요.

---

## 백엔드 API 현황

- **테스트**: 524개 통과 (백엔드 관리 세션 기준, 2026-09-02)
- **서버**: `weddingpickl.fly.dev` (Fly.io)
- **미확인**: 프로덕션 환경 전체 API 엔드포인트 수, 커버리지 %

---

## 코드 구조 주요 경로

```
WeddingPickl/
├── apps/
│   ├── mobile/              # Expo Router 모바일 앱
│   │   └── src/app/         # 42개 라우터 파일 (화면)
│   └── api/                 # Hono API 서버 (Fly.io 배포)
├── packages/
│   ├── db/
│   │   └── migrations/      # 0001 ~ 0052 SQL 파일
│   ├── domain/              # 도메인 상수·정책 (terms.url, privacy.url 여기)
│   └── ...
├── docs/
│   ├── 통합정책 v3.13/      # 현재 확정 기준 정책
│   ├── design-handoff/      # 디자인 핸드오프 (IA 176화면)
│   ├── AI_HANDOFF.md        # 이 파일
│   └── 05-product-spec.md   # Phase 1 제품 스펙 (A-01~A-18)
└── .github/workflows/       # CI/CD 워크플로
```

---

## 정책 문서 참조

기준: `docs/통합정책 v3.13/`  
코드와 정책이 충돌하면 **정책이 맞다.** 코드를 고친다.

주요 섹션:
- `§I-4` — 월간 웨딩지원금 추첨 (4개 미션 완료 조건, NPay 5만원×2명)
- `§J-3` — 탈퇴 화면 UX 문구
- `§A~§H` — 업체·검색·Pick·비교 핵심 정책

---

## 다음 작업 우선순위

1. **[사용자]** expo.dev에 ASC API Key 62U8N2ZWJR 등록 → iOS 빌드 재시작
2. **[사용자]** Fly.io: `OPERATOR_SESSION_TTL_DAYS=365` 추가
3. **[사용자]** Neon DB: `db-migrate.yml` 실행 → 0052 적용
4. **[사용자]** terms.url · privacy.url 확정 → 도메인 상수 업데이트
5. **[AI]** 프론트엔드 미구현 화면 구현 — 남은 우선순위: 카메라 품질 피드백(밝기·흔들림·잘림, 이미지 분석 필요해 원격 세션에서 보류 중) > 개인화 웨딩피드 필터링(WP-HOME, 취향·지역 기준 콘텐츠 필터 없음) > 일정 추가(WP-OUR-004~006, 신규 API 필요) > 지도 보기(WP-SRCH-007, 지도 SDK·업체 좌표 데이터 필요)
   - 회원탈퇴(WP-MY-008)는 `/my/withdrawal`에 이미 구현돼 있음(기존 구현 확인함)
   - 취향 다시 고르기(WP-MY-004)는 `/my/preferences`로 2026-09-02 구현 완료 — 홈의 `TastePicker`·`taste.ts`를 그대로 재사용, MY 설정 화면에서 진입
   - 준비 타임라인(WP-OUR-012)은 `/wedding/[id]/timeline`으로 2026-09-02 구현 완료 — 기존 tasks/expenses/visit-notes/candidates API 4개를 합쳐 시간순 정렬, 새 백엔드 없음. 최종결정은 결정 시각을 서버가 안 남겨 의도적으로 뺌(정확하지 않은 순서를 보여줄 수 없어서)
   - 예식 완료(WP-OUR-013)는 `/wedding/[id]/complete`로 2026-09-02 구현 완료 — `packages/domain/src/lifecycle.ts`의 `lifecycle()`·`isBeforeWedding()`을 문지기로 써서 예식 전엔 안내만, 예식 뒤엔 총지출·미제보 결제내역(직접 입력 지출 중 Pick 인증 안 거친 것)·결정 업체별 후기 쓰기 CTA를 보여줌. **주의**: `isBeforeWedding`/`showsPreparationFirst`는 이 화면 전에는 앱 어디서도 안 쓰이던 죽은 코드였다 — 이번에 처음 실사용에 연결했다. 홈 화면 콘텐츠 우선순위를 `showsPreparationFirst`로 바꾸는 건 범위 밖으로 남겨뒀다(홈 로직 건드리는 리스크 회피) — 다음 세션이 볼 만한 항목
   - "준비 알림 중단"은 이 화면에서 스위치를 흉내 내지 않았다 — 푸시를 실제로 보내는 쪽은 서버라, 프론트가 알림을 껐다고 표시해도 실제로 안 꺼지면 거짓말이 된다. 서버가 예식 뒤 준비 알림을 그만 보내게 하려면 백엔드 세션이 lifecycle stage를 보고 판단하는 로직이 필요함
6. **[AI]** 공통 Bottom Sheet 16종 인라인 처리 여부 확인
7. **[AI]** 관리자 화면 설계 및 구현 (앱스토어 출시 후 단계)

---

## 변경 금지 / 주의

- `--no-verify` 사용 금지
- 마이그레이션 파일 번호 순서 역행 금지 (0052 다음은 0053)
- `main` 브랜치 직접 푸시 금지 — 항상 PR 경유
- `assertReleasable('production')` 우회 금지 — terms.url/privacy.url 설정이 올바른 해결책
- expo.dev 크리덴셜은 Claude가 접근 불가 — 사용자 직접 처리

---

## 롤백

| 항목 | 롤백 방법 |
|---|---|
| DB 마이그레이션 0052 | `0052_mission_draw.sql` DROP 구문 없음 — 수동 롤백 필요 |
| release.yml | git revert로 이전 커밋 복원 |
| Fly.io 환경변수 | `flyctl secrets unset OPERATOR_SESSION_TTL_DAYS` |

---

## 프론트엔드 화면별 상세 갭 분석 (디자인 핸드오프 21개 화면 기준)

> 아래는 `docs/design-handoff/README.md` 기준 21개 화면을 코드와 1:1 대조한 결과다.
> 참고: `docs/design-handoff/웨딩픽 앱 v7.dc.html`은 레포에 없어 README 기준으로 분석.
>
> **2026-09-02 재검증**: 아래 표는 이 대조가 이뤄진 시점의 스냅샷이고, 이후 여러 세션이
> 항목 다수를 이미 고쳤다 — 실제 미구현 여부를 다시 세션이 판단하지 말고 반드시
> 파일을 직접 열어 확인할 것. 이번 재검증에서 이미 해결된 것으로 확인된 항목:
> 인증후기 섹션(8번), 동의 체크박스(10번), 카메라 3:4 프레임(11번), 파괴적 동작 컨펌
> 3종(14·16번+체크리스트), 미션 완료 모달 바운스(18번), 검색 자동완성(7번). 아래 원문은
> 그대로 두고 각 항목에 상태만 덧붙인다.

### 우선순위별 핵심 갭

**높음 — 사용자가 바로 체감:**
1. ~~인증후기 섹션 완전 누락~~ — **해결됨(2026-09-02 확인)**. `search/[vendorId]/index.tsx:346-369`에 미리보기 후기 카드 + "후기 보기" 버튼 있음
2. **카메라 품질 피드백 없음** — `capture/camera.tsx`: 3:4 프레임은 구현됐음(76-84번 줄). 밝기·흔들림·잘림을 실제로 검사하는 로직은 없음 — `capture/review.tsx:92`의 안내 문구뿐. 이미지 분석(휘도·블러 검출)이 필요해 순수 UI 작업 범위를 넘음 — 원격 세션에서 기기 없이 검증 불가해 보류
3. ~~동의 체크박스 없음~~ — **해결됨(2026-09-02 확인)**. `capture/payment/consent.tsx`에 전체 동의·개별 동의 체크박스, 미동의 시 CTA 비활성 모두 구현됨

**중간 — 정책·UX 이슈:**
4. ~~파괴적 동작 컨펌 없음~~ — **해결됨(2026-09-02 확인)**. tasks/visit-notes/expenses 전부 `Alert.alert` 컨펌 있음
5. **홈 다음 일정 섹션 대체** — 디자인의 "다음 일정" 고정 섹션이 Priority Engine 카드로 교체됨(의도적 변경, 아래 참고)
6. **홈 편집 드래그 없음** — `home-edit.tsx` 주석에 인지됨, 위/아래 버튼으로 대체(의도적 변경)

**낮음 — 비주얼 세부:**
7. 스플래시 심볼 88px (디자인 64px) — `features/splash/splash-view.tsx:85`. **재확인 결과 여전히 88px** — 82번 줄 주석("0.88에서 1로")을 보면 의도적으로 키운 값일 수 있어, 디자인 쪽 확인 없이 임의로 64px로 되돌리지 말 것
8. ~~미션 완료 모달 바운스 애니메이션 없음~~ — **해결됨(2026-09-02 확인)**. `my/index.tsx:82,140-147,393-401`에 `Animated.spring` bounce 있음
9. ~~검색 자동완성 드롭다운 없음~~ — **해결됨(2026-09-02 확인)**. `search/index.tsx:110-117,325-341`에 업체·플래너 이름 매칭 드롭다운 있음
10. ~~지출 현황 ⓘ 툴팁 없음~~ — **moot(2026-09-02 확인)**. 홈 C-1 확정 재설계로 지출 섹션 자체가 홈에서 빠짐 — 지출은 `/wedding/[id]/expenses`에서만 본다. 홈에 없는 섹션에 툴팁을 붙일 수 없어 항목 자체가 무효

### 화면별 상태 요약

| # | 화면 | 상태 | 핵심 누락 |
|---|---|---|---|
| 0 | 스플래시 | ⚠️ | 심볼 88px (설계 64px) |
| 1 | 온보딩 | ✅ | 경미한 레이아웃 차이만 |
| 2 | 이름·예식일 등록 | ⚠️ | 이름 필드 없음, 지역·예산 추가 (정책 변경) |
| 3 | 예식일 캘린더 | ✅ | WeddingCalendar 컴포넌트로 정상 구현 |
| 4 | 로딩 스켈레톤 | ⚠️ | 탭바 숨김 여부, 1.6초 고정 여부 미확인 |
| 5 | 홈 | ⚠️ | 다음 일정→Priority Engine, 지출 툴팁 없음 |
| 6 | 홈 편집 | ⚠️ | 드래그 없음 (버튼 대체, 주석에 인지됨) |
| 7 | 검색 | ✅ | 자동완성 구현됨(2026-09-02 확인). 정렬 드롭다운→칩은 의도적 변경 |
| 8 | 업체 상세 | ✅ | 인증후기 미리보기+링크 구현됨(2026-09-02 확인). 상담연결·영업상태 없음은 의도적(앱이 중개하지 않는 원칙) |
| 9 | 비교함 | ⚠️ | "순위 안 매김" 문구, "의견 공유하기" 확인 필요 |
| 10 | 결제내역 등록 동의 | ✅ | 전체 동의 Checkbox 구현됨(2026-09-02 확인) |
| 11 | 촬영 | ⚠️ | 3:4 가이드 프레임은 구현됨(2026-09-02 확인). **품질 피드백(밝기·흔들림·잘림)만 여전히 없음** — 이미지 분석 필요, 보류 |
| 12 | 읽은 내용 확인 | ⚠️ | A-05~A-10 분리 구현, 상세 확인 필요 |
| 13 | 등록 완료 | ⚠️ | 파일 존재, 내용 확인 안 됨 |
| 14 | 지출내역 | ✅ | 삭제 컨펌 구현됨(2026-09-02 확인) |
| 15 | 웨딩 스케줄 | ⚠️ | "직접 지정" 표기, 삭제 컨펌은 구현됨(2026-09-02 확인) |
| 16 | 방문노트 | ✅ | 삭제 컨펌 구현됨(2026-09-02 확인) |
| 17 | MY | ⚠️ | 메뉴 구조 다름, 추가 항목 있음 |
| 18 | 미션 완료 모달 | ✅ | 바운스 애니메이션 구현됨(2026-09-02 확인) |
| 19 | 설정 | ⚠️ | 가격 변동 알림 Switch 확인 필요 |
| 20-알림 | 알림 | ✅ | 정상 구현 |
| 20-배우자 | 배우자 연결 | ✅ | 정상 구현 |
| 20-제보 | 내 제보 내역 | ✅ | 정상 구현 |
| 20-반론 | 업체 반론 등록 | ✅ | 정상 구현 |
| 20-문의 | 문의하기 | ✅ | 정상 구현 |
| 20-약관 | 약관·정책 | ✅ | 정상 구현 |

### 공통 횡단 갭

**파괴적 동작 컨펌 다이얼로그 — 전부 해결됨(2026-09-02 확인):**
| 대상 | 파일 | 상태 |
|---|---|---|
| 체크리스트 삭제 | `(tabs)/wedding/[id]/tasks.tsx` | ✅ `Alert.alert` 컨펌 |
| 방문노트 삭제 | `(tabs)/wedding/[id]/visit-notes.tsx` | ✅ `Alert.alert` 컨펌 |
| 비용 항목 삭제 | `(tabs)/wedding/[id]/expenses.tsx` | ✅ `Alert.alert` 컨펌 |
| 배우자 연결 해제 | `(tabs)/wedding/partner.tsx` | ✅ 2단계 구현 |
| 로그아웃 | `(tabs)/my/settings.tsx` | ✅ Alert 사용 |

### 정책 변경으로 의도적 차이 (버그 아님)
- 이름 필드 제거: v3.10 §3
- "배우자와 실시간 공유" Switch 제거: v2.0 원문 30번 폐기
- 상담연결 CTA 없음: 앱이 중개하지 않는 원칙
- 잠금 카드 대신 stage 기반: v2.0 K-6 잠금 폐기

### 디자인에 없지만 추가 구현된 화면
업체 관계자 인증(`my/vendor-claims/`), 친구초대·홍보인증(`my/rewards.tsx`), 촬영 안내(`my/guide.tsx`), 플래너 상세(`search/planner/[plannerId].tsx`), 샘플 미리보기(`capture/sample.tsx`) 등

---

## 이전 세션(디자인·인프라) 추가 노트

## 변경 금지 / 주의
- do_not_change:
  - **회원탈퇴 자동 삭제 백엔드를 만들지 말 것.** `packages/domain/src/withdrawal.ts`의 `WITHDRAWAL_NOTICE`가 개인정보처리방침 확정 전까지 `null`인 명시적 게이트다. 스키마상 `structured.users` 하드 삭제는 FK CASCADE로 확인된 정보(quotes)까지 지운다 — 위험. `payment_proofs`/`price_reports`를 "통계 제외"할지 "익명화 유지"할지도 정책 §46이 명확히 안 정했다. 이 정책들이 정해지기 전엔 손대지 말 것.
  - NPay·월간 웨딩지원금 기능을 만들지 말 것(위 미완료 항목 참조, 개인정보 처리방침과 함께 정리해야 함).
  - 소셜 로그인 관련 파일(`identity-provider.ts`, `config.ts`, `client.ts` 등)은 이번 세션에서 커밋됐지만, **네이버는 아직 실제 제공자 목록에 노출 안 함** — 서버 콜백·토큰 교환 API가 따로 필요하다(`docs/social-login-handoff.md` 참조). 임의로 노출시키지 말 것.
  - `docs/design-handoff/seed/`는 원본 그대로 유지 — 화면 구현할 때 이 폴더 안의 `.dc.html` 파일을 직접 고치지 않는다(참고용 원본).

## 롤백
- rollback_note: 커밋 4개(`f22a512`, `bba48ed`, `10ce66a`, `cf07b15`)는 서로 기능적으로 독립적이라 필요하면 개별 `git revert <hash>`로 되돌릴 수 있다. 순서상 뒤 커밋이 앞 커밋의 파일을 다시 건드리지 않으므로 역순 revert도 안전하다. 전부 origin/main에 push 완료 — 로컬에만 있는 미커밋 변경 없음(`.npm-cache/` 잡음 제외).
