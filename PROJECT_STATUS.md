# WeddingPick Project Status

> 웨딩픽의 **현재** 상태를 적는다. 세션 기록은 여기 쌓지 않는다 — 작업 이력은
> `docs/AI_HANDOFF.md`, 그보다 오래된 것은 Git history에서 본다.
> 작업 시작 시 `/AI_START_HERE.md` → 최신 통합정책서 → 이 문서 → 최신 코드 순으로 확인한다.

- 기준 main: `eff6f59` (2026-09-07)
- 정책 기준: `docs/통합정책 v3.15` + `CLAUDE.md`의 «정책 변경» 절(위쪽이 최신, 아래보다 우선)
- 미해결 결함 목록: `docs/AI_HANDOFF.md`의 «미해결 결함» 절

## 현재 운영 기준

- 공식 Source of Truth: GitHub `jsexy0210-ship-it/WeddingPickl`의 `main` 하나다.
- 실제 구현 여부는 문서가 아니라 최신 코드로 확인한다.
- 기존 구현 확인 → 재사용 → 통합/재가공 → 없는 것만 신규 개발.
- GitHub Actions를 개발·검증·배포의 단일 컨트롤 타워로 운영한다.
- Claude 세션은 역할 기준 5개(MASTER · FE · BE · DATA · RELEASE)만 유지하고, 루틴은 반복
  가치가 있는 것만 남긴다. 세션·루틴 구성과 운영 규칙은 `docs/AI_HANDOFF.md`의 «세션 운영 구조» 절.

## 인프라

| 대상 | 상태 |
|---|---|
| GitHub | 코드·정책·Actions·Secrets 기준 |
| Render — 운영 API | `https://weddingpickl.onrender.com`. Blueprint 밖에서 별도 관리 |
| Render — 스테이징 API | `weddingpick-api` (`NODE_ENV=staging`, `STORAGE_DRIVER=local`). `/health` = `{"ok":true,"database":"ok"}` 확인(2026-09-05) |
| Render — 웹 | `weddingpick-web` · `weddingpick-admin` · `weddingpick-app-web`(모바일 웹 export). 모두 free 플랜 |
| Neon PostgreSQL | 운영 DB + `weddingpick_staging`(0001~0073 적용 완료) |
| Naver Cloud Object Storage | `weddingpick-test`. 업로드/다운로드/삭제 테스트 성공 |
| Expo / EAS | Android·iOS 빌드 |
| Apple Developer / App Store Connect | ASC API Key `EAS Build` 등록 완료 |
| Google Play Console | 개발자 계정 본인확인 이의 제기 결과 대기 중 |

환경변수의 원본은 `infra/render-env.yml`이고 `.github/workflows/render-env-sync.yml`이
Render에 밀어넣는다. `render.yaml`의 `envVars`는 반영되지 않는다(Blueprint sync API 미동작).

## 완료

- Neon 연결·마이그레이션 적용 (스테이징 0001~0073)
- Object Storage 연결·왕복 테스트
- 일정(`wedding_events`, 0061)·지도 보기(업체 좌표, 0062) 백엔드·화면. 업체 검색·상세는
  카카오맵 외부 링크를 쓴다. 좌표 백필은 `scripts/geocode-vendors.mts` 수동 실행
- 로그인 전면 개편 v3.12 — 카카오 + 이메일 2종(#86·#89·#90·#91·#93)
- 웹 링크 공유 미리보기(OG/Twitter) — 운영 검증 완료(#64)
- 홍보 자동화 파이프라인 골격 — 스키마·CLI·관리자 엔드포인트 8개·0072 마이그레이션(#62 계열)
- 공공데이터 수집 파이프라인 — 이천·제천 CSV, 전국 상권 CSV 어댑터, 출처별 최신성·중복·잠금
- Render 환경변수 자동 반영(#96), 서버 로그 활성화(#100), `public-data.yml` 무효 처리 수정(#88)
- 저장소 정리(2026-09-07) — Open PR은 진행 중인 #101만 남김. remote branch 60개는
  삭제 대상으로 판정했으나 **아직 남아 있다**(세션 프록시가 ref 삭제를 막았다).
  삭제 명령과 근거는 `docs/AI_HANDOFF.md`의 «삭제 대기 브랜치» 절

## 미완료 · 장애

**출시 차단 3건과 그 아래 결함 목록은 `docs/AI_HANDOFF.md`의 «미해결 결함» 절이 정본이다.**
여기서는 인프라·외부 계정 쪽만 적는다.

### iOS

- Release #13에서 Provisioning Profile에 Sign in with Apple capability/entitlement가
  없어 빌드 실패. App ID `kr.weddingpick.app`에 활성화 후 EAS credentials에서 Profile 재생성 필요.
- 추측으로 Apple Credential/API Key를 재생성하지 않는다.

### Google Play

- 계정 제한 해제 전 production submit을 강제 실행하지 않는다.
- 해제 후 기존 release workflow에 제출 자동화를 연결한다.

### 운영 DB

- 운영 Neon에 `db-migrate.yml` 실행 여부를 확인해야 한다. 스테이징만 최신이다.
- 0072(마케팅)·0071(공공데이터 출처) 운영 반영 미확인.

### 검증 못 한 것

- 실기기(Android/iOS) 로그인·지도 링크 검증
- 메신저 앱 내부 링크 미리보기 캐시 갱신
- `weddingpick.kr` DNS 연결 후 `SITE_ORIGIN` 변경 및 재검증
- 홍보 파이프라인의 DB 통합 테스트(격리 PostgreSQL 필요), 관리자 화면 실제 실행

## CI/CD 구조

```
일반 개발   수정 → push → CI → 필요한 DB migration → Render 자동 배포 → health check
앱 릴리즈   Release workflow 1회 → EAS Production Build → iOS/Android → Store Submit
```

- 앱은 매 commit마다 production build하지 않는다.
- CI·migration·deploy·health check 중 하나라도 실패하면 이후 production 단계를 중단한다.

워크플로 10개(`.github/workflows/`)는 목적이 각각 다르다 — 중복 없음.

| 파일 | 언제 도는가 |
|---|---|
| `main.yml` | main push · PR → CI. workflow_dispatch → staging/production 배포 |
| `release.yml` | 수동 — EAS Production Build + 스토어 제출 |
| `android-apk.yml` | 수동 — EAS 없이 로컬 gradle로 검수용 APK |
| `eas-apk-preview.yml` | 수동 — EAS preview 프로필로 설치용 APK |
| `eas-init.yml` | 수동 — EAS 프로젝트 연결(사실상 1회성, 계정 이전 시 재사용) |
| `db-migrate.yml` | 수동 — 운영 Neon 마이그레이션 |
| `db-migrate-staging.yml` | 수동 — `STAGING_DATABASE_URL` 대상 |
| `render-env-sync.yml` | `infra/render-env.yml` 변경 push · 수동 |
| `storage-test.yml` | 수동 — S3 호환 스토리지 왕복 점검 |
| `public-data.yml` | 수동 · 토요일 크론 — 공공데이터 수집·검증 |

## 다음 작업 우선순위

1. **N01** — 운영 카카오 로그인 500 재현 → Render 로그의 SQL 오류로 원인 확정 → 수정
2. **G04** — CORS 출처(admin·커스텀 도메인)와 PATCH 메서드 허용
3. **G02** — main 보호 규칙에 필수 PR + head CI 성공 추가
4. 관리자 kill switch 실제 연결(잔존-A), 이메일 인증 경로 호출 제한(G08)
5. 배포 환경별 secret·health URL 분리(G05)
6. iOS Sign in with Apple 권한·Provisioning Profile 수정 후 Production Build·TestFlight
7. 운영 Neon 마이그레이션 상태 확인 및 적용
8. Google Play 계정 제한 해제 후 Android 제출 자동화
9. `SBIZ_API_KEY` 등록 → 업종 소분류 코드 조사 → `collect.ts`의 `'Q'` 교체
10. 카카오 REST API 키 발급 → 업체 좌표 백필

## 제품 범위 결정

- (2026-09-05) **플래너 기능·광고 제휴 기능 삭제 확정.** 우선순위 P2 — 상세는
  `CLAUDE.md`의 «정책 변경 — 2026-09-05» 절. 착수 전 영향범위 조사·계획 보고가 선행된다.
- (2026-09-02) **초기 출시는 예식 당일까지만 지원한다.** 예식 완료(post-wedding)
  이후 화면·CTA·API는 이번 출시 범위 밖이다. 근거는 통합정책 D-4.

## 갱신 규칙

이 문서는 **현재 상태**만 담는다. 세션에서 무엇을 했는지는 `docs/AI_HANDOFF.md`에 적고,
여기에는 그 결과로 바뀐 상태만 반영한다. 과거 세션 기록을 최신 완료 근거로 쓰지 않는다.
운영 기록과 코드·실기기 검증 결과를 구분하고 확인 날짜·커밋을 남긴다.

다음이 바뀌면 작업과 함께 갱신한다 — 기능 완료 · 인프라 연결/제거 · 배포 구조 변경 ·
장애 발생/해결 · 외부 심사나 계정 상태 변경 · 작업 우선순위 변경.
단순 리팩터링처럼 상태 변화가 없는 작업은 갱신하지 않아도 된다.

P0 항목별 완료 기준과 검증 증거가 확정되기 전에는 P0 진척률을 미측정으로 표시한다.
`npm run progress`의 전체 문서 공정률은 P0 출시 준비율이 아니다.

## 마지막 상태 기준일

2026-09-07
