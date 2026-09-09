# 릴리즈 때 서버를 나눈다 — 환경 · 시크릿 재정리 (2026-09-09)

사용자 결정: **지금은 스테이징과 운영이 한 몸이고, 릴리즈 단계에서 서버를 나눈다.**
그 전제로 환경변수 · 시크릿 · 워크플로를 다시 짠다.

## 1. 지금 상태 — 이름과 실제가 어긋나 있다

| 이름 | 실제로 가리키는 것 | 근거 |
|---|---|---|
| `DATABASE_URL` | **운영 DB** | `infra/render-env.yml`이 운영 API 서비스(`WeddingPickl`)에 이 값을 넣는다. `db-migrate-staging.yml` 머리 주석도 「`db-migrate.yml`의 `DATABASE_URL`(운영 DB)」이라고 적었다 |
| `STAGING_DATABASE_URL` | 스테이징 DB | `db-migrate-staging.yml`만 쓴다. 자동 파이프라인은 건드리지 않는다 |
| `PRODUCTION_DATABASE_URL` | 운영 DB | `db-status.yml`의 조회에서만 쓴다. `DATABASE_URL`과 같은 곳을 가리키면 값이 둘로 갈린다 |

**가장 큰 문제는 `main.yml`의 잡 이름이다.** 잡 이름이 `deploy-staging`이고 조건도
「환경 = staging」인데, 그 안에서 마이그레이션에 쓰는 값은 `secrets.DATABASE_URL` — 곧 운영 DB다.
지금은 서버가 하나라 결과가 같지만, **서버를 나누는 순간 「스테이징 배포」가 운영 DB를 고치게 된다.**
나누기 전에 반드시 고쳐야 하는 자리다.

Render 쪽도 한 벌뿐이다. `render.yaml`의 네 서비스(`weddingpick-web` · `weddingpick-admin` ·
`weddingpick-app-web` · `WeddingPickl`)가 전부 main을 autoDeploy한다. 스테이징용 서비스는 없다.

## 2. 나눈 뒤의 목표 상태

### 서비스

```
스테이징   weddingpick-api-stg · weddingpick-app-web-stg · weddingpick-web-stg · weddingpick-admin-stg
운영       WeddingPickl · weddingpick-app-web · weddingpick-web · weddingpick-admin
```

스테이징은 main을 autoDeploy한다. **운영은 autoDeploy를 끈다** — 사람이 누른 배포로만 올라간다.

### 시크릿

| 이름 | 쓰는 곳 | 비고 |
|---|---|---|
| `STAGING_DATABASE_URL` | 스테이징 마이그레이션 · 시드 · 상태 조회 | main push마다 자동 |
| `PRODUCTION_DATABASE_URL` | 운영 마이그레이션 · 상태 조회 | 수동 + 승인 |
| `RENDER_API_KEY` | 환경변수 동기화 · 배포 상태 · 수동 배포 | 양쪽 공용 |
| `KAKAO_CLIENT_SECRET` | 카카오 토큰 교환 | 앱 키가 환경별로 다르면 `STAGING_`을 하나 더 만든다 |
| `SBIZ_API_KEY` | 공공데이터 수집 | 수집은 스테이징에 먼저 넣고 검수 후 운영에 반영 |

**`DATABASE_URL`은 없앤다.** 이름이 어느 환경인지 말하지 않아 사고를 부른다. 지우기 전에
`main.yml` · `db-migrate.yml` · `db-seed-samples.yml` · `public-data.yml` · `render-env.yml`의
참조를 전부 새 이름으로 옮긴다. `PRODUCTION_DATABASE_URL`이 지금의 `DATABASE_URL`을 물려받는다.

### 환경변수 선언

`infra/render-env.yml`을 환경별로 가른다. 서비스 이름이 다르므로 블록을 하나 더 두면 된다.
스테이징 블록의 `secrets:`는 `STAGING_DATABASE_URL`을, 운영 블록은 `PRODUCTION_DATABASE_URL`을
읽는다. `vars`의 API 주소도 환경별로 다르다 — 스테이징 앱 웹은 스테이징 API를 봐야 한다.

### 워크플로

| 워크플로 | 지금 | 나눈 뒤 |
|---|---|---|
| `main.yml` | main push → 「스테이징」이라 적고 운영 DB 마이그레이션 | main push → **스테이징만**. 운영 배포는 별도 수동 워크플로 |
| 운영 배포 (신설) | 없음 | 수동 실행 + GitHub Environment 승인. 마이그레이션 → 배포 → 헬스체크 → 실패 시 중단 |
| `db-migrate.yml` | `DATABASE_URL` | `PRODUCTION_DATABASE_URL` · 승인 필요 |
| `db-migrate-staging.yml` | `STAGING_DATABASE_URL` | 그대로. 자동 파이프라인이 대신하므로 비상용으로만 남긴다 |
| `db-seed-samples.yml` | `DATABASE_URL` | **스테이징 전용으로 고정**. 운영에 샘플을 넣을 길을 아예 없앤다 |
| `db-status.yml` | 세 갈래 | 두 갈래(스테이징 · 운영) |
| `public-data.yml` | `DATABASE_URL` | 스테이징에 먼저 적용 · 검수 뒤 운영 |
| `keep-warm.yml` | 운영 API | 스테이징도 깨울지 결정 필요(무료 플랜이면 둘 다 잠든다) |

### 안전장치

1. **GitHub Environment 「production」에 승인자를 건다.** 운영에 닿는 잡은 전부 그 환경에 넣는다.
2. **운영 잡은 `github.ref == 'refs/heads/main'`을 확인한다.** 브랜치에서 운영을 건드릴 수 없게.
3. **시드·테스트 데이터 워크플로에는 운영 DB 주소를 아예 넘기지 않는다.** 실수의 여지를 없앤다.
4. 스테이징과 운영의 **DB는 반드시 다른 인스턴스**여야 한다. 같은 값을 넣으면 이 구조가 무의미하다.

## 3. 옮기는 순서

나누는 날 한 번에 하지 않는다. 앞의 셋은 지금 해도 안전하다.

```
1  이름 정리     DATABASE_URL 참조를 PRODUCTION_DATABASE_URL로 옮긴다. 값은 그대로 — 동작은 안 바뀐다
2  잡 이름 정정   main.yml의 «deploy-staging»을 사실대로 고친다. 지금은 운영 배포다
3  시드 차단     db-seed-samples를 스테이징 전용으로 묶는다
4  서비스 생성    Render에 스테이징 4종 · 스테이징 Neon DB
5  선언 분리     render-env.yml을 환경별 블록으로
6  파이프라인 분리 main push → 스테이징 / 운영은 수동 + 승인
7  운영 autoDeploy 끄기
8  DATABASE_URL 삭제
```

1~3을 먼저 하면 **나누기 전에도 사고 위험이 줄고**, 나누는 날의 작업이 4~8로 짧아진다.

## 4. 아직 못 정한 것

- 스테이징 Render 서비스를 무료 플랜으로 둘지. 무료면 15분마다 잠들어 검수 때마다 기다린다.
- 카카오 앱을 환경별로 나눌지. 한 앱을 공유하면 스테이징 리다이렉트 URI를 운영 앱에 등록해야 한다.
- 스테이징 데이터를 운영에서 복사할지, 시드만 쓸지. 복사하면 개인정보가 스테이징으로 넘어간다 —
  복사한다면 마스킹이 먼저다.
