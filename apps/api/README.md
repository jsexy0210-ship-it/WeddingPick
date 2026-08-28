# @weddingpick/api

앱이 부르는 서버. [`packages/api-contract`](../../packages/api-contract)를 그대로 구현한다.

상시 구동 Node 서버(Fastify) + PostgreSQL.

## 실행

```bash
cp apps/api/.env.example apps/api/.env   # 값을 채운다
npm run migrate --workspace @weddingpick/db
npm run dev --workspace @weddingpick/api      # API 서버
npm run worker --workspace @weddingpick/api   # 분석 워커 (별도 프로세스)
```

워커는 API와 따로 돈다. 문서 하나를 읽는 데 시간이 걸리므로 요청 처리와 섞지 않는다.

테스트는 실제 PostgreSQL이 필요하다. `DATABASE_URL`이 없으면 건너뛴다.

```bash
DATABASE_URL=postgres://... npm test --workspace @weddingpick/api
```

## 구조

```
src/
  config.ts       환경변수 파싱. 빠진 값은 켜질 때 걸린다
  db.ts           연결 풀과 트랜잭션
  errors.ts       계약이 정한 오류 모양
  access.ts       내 웨딩·내 문서인지 확인
  auth/           OIDC 검증, 세션 발급
  storage/        원본 저장소 포트 + S3 어댑터
  routes/         계약의 각 경로
  quote-view.ts   문서 하나를 계약 모양으로 읽기
  analysis/       AI 문서 분석 — 스키마, 분석기, 업체 매칭, 저장, 워커
  retention/      원본 자동삭제
  worker.ts       워커 진입점 (분석 + 보관 정리)
  vendors-import.ts  업체 CSV 등록
```

## 업체 등록과 매칭

공개 인허가 자료로 한 번에 등록한다. 자세한 것은 [src/public-data/README.md](src/public-data/README.md).

```bash
npm run public-data:import --workspace @weddingpick/api -- \
  --file 예식장.csv --category hall --dry-run
```

손으로 몇 곳만 넣거나 별칭을 붙일 때는 CSV로도 넣을 수 있다.

```bash
npm run vendors:import --workspace @weddingpick/api -- vendors.csv
# category,name,region,source[,별칭1;별칭2]
# hall,더채플앳청담,서울 강남구,vendor_official,채플앳청담;더채플
```

AI는 문서에 적힌 이름을 읽을 뿐이고, 그것이 어느 업체인지 확정하는 것은 서버 몫이다
(사업계획서 27번).

- 공백·괄호·가운뎃점을 지운 이름이 **정확히 같을 때만** 연결한다. 비슷하다고 넘겨짚으면
  남의 업체 가격이 내 비교에 섞인다 — 틀린 연결보다 연결하지 않는 편이 낫다
- 같은 이름이 여러 지역에 있으면 연결하지 않는다
- 연결하지 못해도 읽은 이름은 `quotes.vendor_name_raw`에 남는다. 업체를 나중에 등록하면
  그 이름으로 기다리던 문서들이 자동으로 연결된다
- `structured.unmatched_vendor_names` 뷰가 아직 등록되지 않은 이름을 빈도순으로 보여준다.
  **어떤 업체를 먼저 등록해야 하는지가 여기 나온다**

## 원본 파기

**검증이 끝난 날로부터 30일** (2026-08-28 확정). 검증 완료는 업로드·사용자 확인·인증
심사 결론 중 가장 나중이고, 아직 결론이 나지 않은 인증 신청의 증빙이면 셈이 시작되지
않는다 — 지우면 심사자가 확인할 근거를 잃기 때문이다.

그래서 파기 시각을 저장하지 않고 `originals.document_retention_schedule` 뷰가 계산한다.
확인과 심사가 끝날 때마다 달라지는 값이라, 저장해두면 화면에 적힌 날짜와 실제로
지워지는 날이 달라진다.

일수는 두 곳에 있다 — SQL의 `originals.retention_days()`와 도메인의
`RETENTION_POLICY.originalDays`. 테스트가 둘이 같은지 본다.

파기 목록이 비어 있는 것을 안전하다고 읽으면 안 된다. 지울 것이 없어서일 수도 있고,
심사가 열려 있어 아직 셈이 시작되지 않아서일 수도 있다. 후자는
`originals.retention_held_for_verification`에 드러나고 `--due`가 함께 말한다.

### 지우는 것은 사람이다

`RETENTION_MODE=manual`(기본값)에서는 서버가 지우지 않는다. 예정일이 되면 운영자에게
푸시로 알리고, 운영자가 `npm run retention -- --due`로 보고 `--delete <id>`로 지운다.
`automatic`으로 두면 예전처럼 서버가 지운다.

기본값을 manual로 둔 것은, 설정을 빠뜨린 환경이 남의 계약서를 조용히 지우는 것보다
지우지 않고 알리는 쪽이 되돌릴 수 있는 실수이기 때문이다.

알림은 **운영자에게만** 가고 본문에는 **건수만** 담는다. 푸시는 잠금화면에 뜨므로,
파기해야 할 개인정보를 알리려다 그것을 다시 흘리면 안 된다. 운영자 표시
(`users.is_operator`)는 사람이 DB에서만 켠다 — 앱에도 API에도 그 값을 바꾸는 길이 없다.

### 파기 기록

지우는 것은 **파일**이고 문서 행은 남긴다. 언제 무엇을 지웠는지가 파기 기록이 된다.
삭제에 실패하면 `delete_failed`로 표시하고 시도 횟수를 올린다 — 조용히 넘어가지 않는다
(서비스정책서 4번).

`npm run retention -- --list`가 손이 필요한 문서를 보여준다. 지우려다 실패한 것과,
페이지 기록이 없어 삭제 작업이 **집어가지도 못하는** 것이 함께 나온다.

## 공개 기준과의 대조

견적서의 위약금 조항과 추가비용 항목을 공개된 소비자 보호 기준과 견줘 문장으로 내려준다
(`quote-view.ts`). 기준값은 `@weddingpick/domain`의 `consumer-standards.ts`에 출처·확인일과
함께 있다.

- 예식 29일 전 취소 시 50%를 물리는 조항 → "기준은 35%입니다"
- 드레스 피팅비·메이크업 얼리스타트비가 추가비용에 있으면 → "기본 제공에 포함하도록 시정된
  항목입니다"

**법률 판단이 아니다.** 적법한지는 말하지 않고 기준과 다르다는 사실만 알린다
(이용약관 제3조, 사업계획서 8번).

## 추출 정확도 측정

```bash
ANTHROPIC_API_KEY=... npm run analysis:eval --workspace @weddingpick/api -- ~/견적서들
```

문서를 넣으면 항목별로 맞았는지 보여준다. 자세한 사용법은 [eval/README.md](eval/README.md).

## 분석 워커

```
대기 중인 분석을 하나 잡는다 (FOR UPDATE SKIP LOCKED)
  → 장별 원본을 저장소에서 읽는다
  → Claude가 문서를 읽고 스키마대로 채운다
  → 견적·항목·조건·추출필드를 한 트랜잭션으로 저장
  → 성공/실패를 남기고 토큰 사용량을 기록
```

**AI가 할 수 없는 것이 스키마로 막혀 있다.** 추출 스키마에는 시장가격·중앙값·적정성 판단이
들어갈 자리가 없다. 문서에 적힌 것만 나온다 (사업계획서 27번).

- 값마다 `confidence`가 붙는다. 낮은 값을 "확인 필요"로 드러내려면 화면이 알아야 한다
- 개인정보는 **종류만** 기록하고 값은 옮기지 않는다 (`personal_info_kinds`)
- 저장 직후 등급은 L0, `confirmed_at`은 비어 있다. 분석만으로는 어떤 계산에도 들어가지 않는다
- 업체는 이름만 읽고 연결하지 않는다. 어느 업체인지 확정하는 매칭은 서버 몫인데 아직 업체
  데이터가 없다. 그래서 지금은 가격 비교가 `vendor_unknown`을 돌려준다 — 없는 가격을
  만들지 않는다
- 워커를 여러 개 띄워도 같은 문서를 두 번 분석하지 않는다. AI 호출은 비용이다

## 지켜지는 것

- **계산은 서버가 한다** — 중앙값·분위수·가격 판단은 `@weddingpick/domain`이 계산한다.
  AI가 만든 값이 통계로 흘러들지 않는다 (사업계획서 27번)
- **집계는 `comparable_quotes` 뷰만 본다** — L2 이상, 사용자 확인 완료라는 조건이 뷰 안에 있다
- **표본이 모자라면 값을 지어내지 않는다** — `available: false`와 이유를 돌려준다
- **인증 신청은 접수만 한다** — 이 경로는 `verification_level`을 건드리지 않는다.
  승인에는 심사자가 남아야 한다는 것을 DB가 막는다 (서비스정책서 7번)
- **원본 파일은 서버를 거치지 않는다** — 서명된 URL로 앱이 스토리지에 바로 올린다.
  계약서 원본이 지나는 경로가 하나 줄어든다
- **세션 토큰 원문을 저장하지 않는다** — SHA-256만 남긴다
- **배우자의 개인정보를 내려보내지 않는다** — 웨딩 응답은 역할과 참여 시각만 담는다

## 아직 없는 것

- **업체 자료 실제 적재** — 공개 인허가 자료를 넣는 도구는 있지만 아직 실제 파일로
  돌려보지 못했다. 이 개발 환경에서는 공공데이터 사이트에 접근할 수 없다
- **실제 견적서로 확인** — 정확도 측정 하네스는 있다([eval/](eval/)). 아직 실제 업체
  견적서로 돌려보지 못했다 — 자격증명과 문서가 필요하다
- **Apple·Kakao 실제 검증** — OIDC 검증 코드는 있지만 실제 제공자 토큰으로 확인하지 못했다.
  클라이언트 ID를 발급받아 실기기에서 한 번 확인해야 한다
- **심사자 권한** — 심사 도구는 사용자 id를 받을 뿐 그 사람에게 권한이 있는지 확인하지
  않는다. 서버에 접근할 수 있는 사람만 명령을 돌릴 수 있다는 것이 유일한 통제다
