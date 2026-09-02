# @weddingpick/web

웹 랜딩. 정적 HTML 한 장을 만든다.

```bash
npm run build --workspace @weddingpick/web   # → apps/web/dist/index.html
```

프레임워크도 런타임 자바스크립트도 없다. 소개 한 장에 필요한 것은 글과 링크뿐이고,
자바스크립트를 켜지 않아도 읽을 수 있어야 한다. CSS는 한 파일에 담아 인라인으로 넣는다.

## 글은 어디서 오나

바뀔 수 있는 것 — 숫자, 기준, 출처, 게시 상태, 안내 문구 — 은 이 워크스페이스에 적지 않고
`@weddingpick/domain`에서 가져온다. 랜딩에 따로 적어두면 기준이 바뀔 때 한쪽만 고쳐지고,
그때 어느 쪽이 우리가 지키는 약속인지 알 수 없게 된다.

| 랜딩의 내용 | 출처 |
|---|---|
| 분석 안내, 결과 고지 문구 | `analysis-notice.ts` — 앱도 같은 것을 쓴다 |
| 확인 단계와 가격 비교 반영 여부 | `verification.ts` |
| 최소 표본 수 | `policy.ts` |
| 예식업 취소 위약금 기준 | `consumer-standards.ts` |
| 자료 출처와 확인일 | `data-sources.ts` |
| 약관·정책의 게시 상태 | `policies.ts` — 앱 정책 화면도 같은 것을 쓴다 |

랜딩 자체의 소개 문구만 [`src/content.ts`](src/content.ts)에 있다.

`src/page.test.ts`가 이 연결을 지킨다 — 도메인 값이 실제로 실렸는지, 게시 상태와 링크가
어긋나지 않는지, 확인하지 않은 이용허락범위를 적지 않았는지.

## 설정

| 환경변수 | 없으면 |
|---|---|
| `WEDDINGPICK_CONTACT_EMAIL` | 문의처를 "아직 정해지지 않았습니다"로 적는다. 지어낸 주소를 붙이면 사람들이 받지 않는 곳으로 편지를 보낸다 |

## 관리자 웹 (`src/admin/`)

랜딩과 다른 프로그램이다. 랜딩은 자바스크립트도 서버도 없는 정적 파일 한 장인데,
관리자 화면(WP-ADM-*)은 요청마다 DB를 읽어야 해서 그 모양으로는 안 된다. 그래서
같은 워크스페이스 안에 별도 Fastify 서버를 하나 더 둔다 — `apps/api`처럼.

```bash
DATABASE_URL=... ADMIN_PASSWORD=... npm run admin:dev --workspace @weddingpick/web
```

- 인증은 HTTP Basic Auth 하나뿐이다(계정 `admin`, 비밀번호는 `ADMIN_PASSWORD`).
  소셜 로그인을 다시 구현하지 않는다 — 지금 운영은 `DATABASE_URL`을 쥔 사람이 CLI로
  직접 쿼리를 돌리는 것이고, 이 서버는 그 접근을 읽기 전용으로 좁히는 것뿐이다.
- **읽기 전용이다.** Kill Switch·정책 편집·롤백 트리거 같은 파괴적 동작은 여기 없다
  — 그런 것들은 계정 하나짜리 공유 비밀로 지킬 계층이 아니다.
- 화면은 클라이언트 자바스크립트 없이 서버가 매 요청 렌더링한다. 랜딩의 "프레임워크도
  런타임 자바스크립트도 없다" 원칙을 그대로 잇는다 — 다른 것은 정적이 아니라 매번
  새로 그린다는 것뿐이다.
- 지금 있는 화면 14개(WP-ADM-001·002·010·012·014·015·020·021·022·023·031·040·050·052)는
  전부 이미 있는 표·뷰를 그대로 읽는다 — 새 마이그레이션 없음. 여러 화면은
  `apps/api/src/*-admin.ts`(CLI 도구: `decisions-admin`·`inquiry-admin`·
  `rebuttal-admin`·`vendor-claim-admin`·`reward-admin`·`ai-cost-admin`)가 쓰던
  쿼리와 같은 것을 쓴다 — 웹 화면과 CLI가 서로 다른 답을 하지 않는다.
- 남은 읽기 전용 화면 5개(WP-ADM-011·013·016·030·032)는 만들지 않았다 — DB를
  뒤져봐도 그 화면이 보여줄 실제 데이터(교차검증 신뢰도 점수, 이상치·조작
  탐지, 이메일 회신 파싱, 마케팅 콘텐츠 자동화, 광고 매출 퍼널)가 아직 어디에도
  없다. 없는 데이터를 있는 것처럼 빈 화면이나 가짜 숫자로 채우지 않았다.
- 배포: `fly.admin.toml` (앱 `weddingpick-admin`, 아직 `fly apps create` 안 됨 —
  사용자 조치 필요). `DATABASE_URL`·`ADMIN_PASSWORD`는 `fly secrets set`으로 넣는다.

| 환경변수 | 없으면 |
|---|---|
| `DATABASE_URL` | 뜨지 않는다(zod 검증 실패) |
| `ADMIN_PASSWORD` | 뜨지 않는다. 16자 미만이면 마찬가지 |
| `PORT` | 3100 |
