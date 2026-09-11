# 웨딩픽 공공데이터 수집

통합정책 v3.15 N-9~N-12(2026-09-04)를 모든 AI가 적용한다.
기존 public-data:import 명령을 재사용한다. 등록된 허용 출처만 저장할 수 있다.

## 키 없이 즉시 수집

저장소 루트에서:

```sh
npm run public-data:import --workspace @weddingpick/api -- --source icheon-halls --out ../../.collection
npm run public-data:import --workspace @weddingpick/api -- --source jecheon-halls --out ../../.collection
```

공식 페이지의 현재 다운로드 링크·라이선스를 확인하고 CSV를 메모리에서 처리한다.
UTF-8/CP949를 판별하며 허용 필드만 출처별 JSON에 기록한다. 원본 CSV·HTML·전화번호·
상세주소·좌표는 파일과 로그에 저장하지 않는다. 명단 수록은 실제 영업 검증이 아니므로
needs_verification으로 기록한다.

## 전국 상권 CSV

공식 소상공인시장진흥공단 CSV가 준비되면:

```sh
npm run public-data:import --workspace @weddingpick/api -- --source sbiz --file /path/region.csv --out ../../.collection
```

[공식 출처](https://www.data.go.kr/data/15012005/openapi.do).

## 운영 OpenAPI (sbiz-seoul · sbiz-gyeonggi)

운영계정 승인 완료 — 신청유형 운영계정, 처리상태 승인, 활용기간 2026-09-08~2028-09-08.
End Point `https://apis.data.go.kr/B553077/api/open/sdsc2`, 상세기능 19종, 각 일일 트래픽 1,000,000.
이용허락범위 제한 없음이라 별도 출처표시 의무는 없다 — 화면 문구는 바꾸지 않는다.

키는 `SBIZ_API_KEY`로만 읽는다(GitHub Secrets → `infra/render-env.yml`이 Render로 전달).
저장소·문서·로그·리포트 JSON 어디에도 키 값을 적지 않는다.

## 전국 수집 (sbiz-all)

`storeListInUpjong`은 업종코드로 묻고 **전국을 돌려준다**. 시도 출처는 그 전국 응답을
받아 `ctprvnCd`로 걸러 나머지를 버리므로, 시도 17곳을 그렇게 하면 같은 응답을 17번
내려받는다. 전국은 `sbiz-all` 하나로 받는다 — 지역을 거르지 않는다.

```sh
npm run public-data:import --workspace @weddingpick/api -- --source sbiz-all --out ../../.collection
```

페이지 상한은 500(`SBIZ_MAX_PAGES`)이고, 상한에 걸려 다 못 받으면 리포트의 `truncated`에
업종코드와 받은 수·전체 수가 남는다. 비어 있어야 전수다.

## 확인된 업종 소분류 코드

2026-09-10 `smallUpjongList`를 실 키로 불러 소분류 1,255개 중에서 골랐다. 추측이 아니라
조회 결과이고, 환경변수가 없으면 이 값이 기본으로 쓰인다(`WEDDING_UPJONG_CODES`).

| 코드 | 업종 | 우리 분류 | 상호 조건 |
| --- | --- | --- | --- |
| S21101 | 예식장업 | 웨딩홀 | 없음 |
| S21105 | 결혼 상담 서비스업 | 결정사 | 없음 |
| M11301 | 사진촬영업 | 스튜디오 · 본식스냅 | 웨딩 · 본식 · 스냅 (없으면 기타) |
| S20701 | 미용실 | 메이크업 · 헤어변형 | 웨딩 · 브라이덜 (없으면 기타) |
| N11004 | 의류 대여업 | 드레스 | 웨딩 · 브라이덜 (없으면 기타) |
| G21901 | 꽃집 | 부케 | 웨딩 · 브라이덜 (없으면 기타) |
| G20904 | 한복 소매업 | 혼수 | 웨딩 · 브라이덜 (없으면 기타) |

**꽃집·한복은 2026-09-11 대표 지시로 더했다** — 「업종코드 확대한다. 실제 데이터
보고 맞지 않을 경우 기타로 다 집어넣는다」. 같은 지시로 상호 조건이 이제 **버리는
조건이 아니라 업종을 확정하는 조건**이다. 조건에 안 맞으면 「기타」로 들어오고 사람이
보고 정한다(수집 결과는 전부 `검증 전`이다).

**아직 코드를 못 찾은 업종 셋: 청첩장(인쇄업) · 예물(귀금속) · 허니문(여행사).**
분류 규칙은 이미 셋을 다루지만 받아올 코드가 없어 **영구 0건**이다. 추측으로 채우지
않는다 — 전에 대분류 `'Q'`를 박았다가 활용가이드에 없는 값이라 수집이 조용히 0건이
된 적이 있다. 아래 「업종코드를 바꿀 때는 조회로 확인한다」의 `--lookup-category`를
`--keyword 청첩` · `귀금속` · `여행`으로 돌려 찾은 뒤 여기와 `WEDDING_UPJONG_CODES`에
넣는다. `public-data.yml`은 `lookup_level=small` + `lookup_keyword`로 같은 일을 한다.

뷔페(I20702 · I20801)는 넣지 않았다. 우리 업종에 자리가 없어 전부 「기타」로만 쌓이는데
전국 업소 수가 많아 검수가 그만큼 는다.

**가져올 코드와 고를 업종은 다른 이야기다.** 위 표는 OpenAPI에서 **받아올** 소분류
코드이고, 받은 행을 무슨 업종으로 **고르는지**는 `resolveSbizCategory`가 정한다.
분류기는 v3.22 업종 12종 + `etc`를 모두 다루므로(아래 «정제 규칙»), `SBIZ_UPJONG_CODES`로
코드를 넓히거나 CSV 출처를 더하면 부케·청첩장·예물·혼수·허니문도 그대로 잡힌다.

드레스는 「드레스」로 찾으면 소분류 이름에 없다. 「대여」로 찾아 N11004 의류 대여업을
확인했다(2026-09-10).

**업종코드를 바꿀 때는 조회로 확인한다.** 조회할 업종은 설정이 이긴다:

```sh
# 1) 코드 조사 — DB 미반영. 대분류 → 중분류 → 소분류 순으로 좁힌다.
npm run public-data:import --workspace @weddingpick/api -- --lookup-category --level large
npm run public-data:import --workspace @weddingpick/api -- --lookup-category --level small --parent-large <대분류> --keyword 예식

# 2) 확인한 코드로 한 지역만 소량 수집 (--apply 없이)
npm run public-data:import --workspace @weddingpick/api -- --source sbiz-seoul \
  --upjong-div-id indsSclsCd --upjong-codes <코드1>,<코드2> --out ../../.collection
```

`--upjong-codes`(또는 `SBIZ_UPJONG_CODES`)를 **명시로 비워 넘기면** 수집을 시작하지 않고
실패한다. 아무것도 주지 않으면 위 표의 확인된 코드를 쓴다.
어떤 코드가 0건을 돌려주면 그것도 실패로 올린다 — 틀린 코드는 오류 대신 빈 목록으로 오기 때문에
조용한 0건 수집이 예전 `'Q'` 하드코딩에서 실제로 일어났다.
CI에서는 저장소 Variables `SBIZ_UPJONG_CODES`·`SBIZ_UPJONG_DIV_ID`가 있으면 그쪽이 이긴다.
CSV 어댑터는 업종명·웨딩 관련 상호로 제한적으로 분류한다. 일반 사진관·미용실은 제외하며,
이 분류도 웨딩 전문성 확정은 아니다. 상가업소번호를 원천 식별키로 쓰고 원본 기준일이
없으면 null을 유지한다. 64 MiB 이하 파일, DB 반영은 실행당 1,000업체 이내로 제한한다.

## 소량 확인 수집

전수를 받기 전에 **무엇이 어떤 업종으로 들어오는지 눈으로 본다**(2026-09-11 대표 지시 —
「소량만 우선 수집해 100건 정도」). 특히 업종코드를 넓힌 뒤에는 「기타」가 얼마나
늘어나는지를 숫자로 보고 코드를 조일지 정한다.

```sh
npm run public-data:import --workspace @weddingpick/api -- --source sbiz-all \
  --limit 100 --out ../../.collection
```

워크플로에서는 수동 실행 입력 `limit`에 `100`을 넣는다. 크론은 이 값을 비워 두므로
정기 실행은 전수 그대로다.

**받아 놓고 자르는 것이 아니라 API를 그만 두드린다.** 상한을 채우면 다음 쪽을 부르지
않는다 — 그래야 소량으로 확인하려던 이유(부하·시간)가 살아 있다. 리포트에 `limit`이
남고 잡 요약에도 「소량 확인 실행이다」라고 찍히므로, 그 숫자를 전체로 잘못 읽지 않는다.

업종코드를 돌아가며 채우지 않고 **앞 코드부터** 채운다. 100건이면 예식장업만으로 다 찰
수 있다는 뜻이라, 업종을 고루 보려면 코드를 하나씩 지정해 따로 돌린다.

```sh
npm run public-data:import --workspace @weddingpick/api -- --source sbiz-all \
  --upjong-div-id indsSclsCd --upjong-codes G21901 --limit 100 --out ../../.collection
```

`--limit`은 반영 상한(`MAX_APPLY`)과 다르다. 저쪽은 「너무 많으면 한 건도 안 쓴다」이고
이쪽은 「이만큼만 받는다」다.

## 운영 DB 반영

수집 결과 확인 후 같은 명령에 --apply를 추가한다. DATABASE_URL이 필요하다.
0071_vendor_public_sources까지 마이그레이션이 적용돼 있어야 한다.
실제 접속문자열은 문서·터미널 출력에 남기지 말고 기존 GitHub Secrets를 사용한다.

신규 등록과 변경 이력은 같은 트랜잭션이다. 같은 자료 재실행은 업체·감사로그를
중복 생성하지 않는다. 원천 기준일이 더 최신인 동일 출처의 매핑된 업체만 변경한다.
출처 간 충돌·잠금·지점 불명확은 보류한다. 기존 가격 자료의 자동 재매칭은 수행하지 않는다.

**한 실행이 반영할 수 있는 수에 상한이 있다**(`run.ts`의 `MAX_APPLY` · 기본 50,000).
넘으면 자르지 않고 **한 건도 쓰지 않고 거절한다** — 잘라서 쓰면 어디까지 들어왔는지가
실행마다 달라지고, 이상한 양이 들어왔다는 사실 자체가 묻힌다. 거절해도 리포트는 먼저
쓰므로(`applyRefused` 칸) `total`·`accepted`·`rejected`를 보고 상한을 올릴지 분류를
고칠지 정한다. 상한은 `PUBLIC_DATA_MAX_APPLY`(환경변수 · 저장소 Variables)로 올린다.
**기본값 50,000은 추정값이다** — 전국 전수를 한 번도 받아 본 적이 없다. 첫 성공 실행의
`accepted`를 보고 실측 기준으로 다시 정한다.
출처는 폐업을 명시로 알려주지 않는다. 그래서 수집 자체는 폐업 전환을 하지 않는다 —
그 판정은 아래 「운영 모니터링」의 별도 도구가 사람의 승인을 받아 한다.

## 운영 모니터링

수집이 무엇을 바꿨고 무엇을 사람에게 넘겼는지 보는 자리다. 워크플로는
`.github/workflows/vendor-monitor.yml`이고 **크론이 없다** — 주 1회 수동 실행이 전제다.

### 무엇이 바뀌었나 (읽기 전용)

```sh
npx tsx scripts/vendor-collection-monitor.ts --days 14 --source sbiz-all
```

`vendor_change_log`와 `vendor_import_holds`를 읽어 이름 · 지역이 바뀐 것과 보류된 것을
나누어 센다. 아무것도 쓰지 않는다.

**업종 변경은 「바뀐 것」이 아니라 「보류」에 있다.** `replacementDecision`이 업종이 다르면
곧바로 hold로 넘기므로(sync.ts) `vendor_change_log`에는 업체가 만들어질 때 말고는 업종 행이
들어오지 않는다. 보류는 0098부터 사유와 함께 `structured.vendor_import_holds`에 남는다 —
그전 실행은 건수만 `import_runs.skipped_count`에 뭉쳐 있어 되살릴 수 없다.

출력은 집계 숫자 · 사유 이름 · `vendor_id`뿐이다. 업체명과 바뀐 값은 찍지 않는다.

### 없어진 업체 (확인이 기본)

```sh
npx tsx scripts/vendor-retire-missing.ts --source sbiz-all --collection .collection
npx tsx scripts/vendor-retire-missing.ts --source sbiz-all --collection .collection --yes
```

같은 실행에서 새로 받은 응답과 `vendor_source_records`를 맞춰 사라진 원천 식별키를 찾는다.
지난주 산출물로 이번 폐업을 판정하지 않는다.

판정을 거부하는 경우가 둘이다. 리포트의 `truncated`가 비어 있지 않으면 그 수집은 전수가
아니므로 「없다」가 폐업이 아니라 못 받은 것이다. 사라진 비율이 10%를 넘어도 거부한다 —
그만큼이 한 주에 동시에 폐업하지는 않으므로 수집을 의심해야 한다.

사라졌다고 판정해도 전부 지우지 않는다:

| 어떤 업체 | 어떻게 |
| --- | --- |
| `admin_locked` · 업체가 확인함(`vendor_claims` approved) · 다른 출처가 아직 가짐 · 수집이 만들지 않음 | 손대지 않는다 |
| 후기 · 제보 · Pick 후보 · 결정 · 정정 · 광고가 매달림 | 지우지 않고 `is_active=false`로 노출만 멈춘다 |
| 매달린 것이 없음 | 원천 매핑과 함께 지운다 |

노출을 가르는 것은 0047의 `is_active` · `closed_at`이고, `collection_status='closed'`는
**수집이 끊었다**는 근거로 함께 적는다. 사람이 다른 이유로 내린 업체에는 그 표시가 없다.

원천 매핑은 남긴다. 그 업체가 다음 수집에 다시 잡히면 `syncCollected`가 되살린다 —
`admin_locked`가 아니고 `collection_status='closed'`일 때만이라, 사람이 내린 업체는
되살아나지 않는다.

## 자동 실행

.github/workflows/public-data.yml이 매주 일요일 03:17 KST에 수집한다(크론 `17 18 * * 6`은
UTC — 토요일 18:17 UTC다. 저장하는 값과 cron은 UTC 그대로 두고, 사람에게 말할 때만 KST로 적는다).

**정기 실행은 DB에 쓰지 않는다.** 반영 단계가 `inputs.apply`를 보는데 schedule 이벤트에는
inputs가 없어 항상 거짓이다 — 크론은 수집·검증까지만 하고 산출물만 남긴다. 반영은 사람이
workflow_dispatch에서 apply를 켤 때만 한다. 산출물은 7일 후 만료한다.

크론은 2026-09-09에 꺼졌다가 2026-09-11에 되살렸다. 끄면서 적어 둔 세 조건이 다음으로 섰다.

| 조건 | 무엇으로 채웠나 |
|---|---|
| 업종 코드 확정 | `collect.ts`의 `WEDDING_UPJONG_CODES`. 2026-09-10 `smallUpjongList` 실측 |
| 0건 가드 | 업종코드가 0건이면 `collect.ts`가 던지고, 지역 필터 전량 탈락은 워크플로의 「수집 결과 0건 확인」이 잡는다 |
| 건수 상한 | `run.ts`의 `MAX_APPLY`와 워크플로의 `PUBLIC_DATA_MAX_APPLY` 확인 |
로컬 .collection은 같은 이름을 덮어쓰므로 반복 실행으로 누적되지 않는다.
운영 DB의 마이그레이션·Secrets가 없으면 실패로 보고한다.

## 정제 규칙

수집한 행은 아래 순서로 거른다. 각 단계의 탈락 수는 `<source>-report.json`에 따로 남는다
(`closed` · `rejected` · `duplicates`) — 한 칸에 합치면 왜 줄었는지 되돌릴 수 없다.

받아들인 것은 `categoryCounts`에 **업종 12종 + 기타로 나눠** 남는다. 0건인 업종도
0으로 적는다 — 「코드를 안 받아와서 0」과 「받았는데 없어서 0」은 다른 이야기이고,
칸이 비어 있으면 그 둘을 구분할 수 없다. 같은 표가 워크플로 실행 페이지 요약에도
찍히므로 산출물을 내려받지 않고 업종별 숫자를 볼 수 있다.

1. **폐업·휴업 제외.** `localdata.ts`의 영업상태 열(`영업상태명` · `상세영업상태명` ·
   `폐업일자`)을 본다. 열이 아예 없는 «현황» 명단 파일은 폐업 신호가 없는 것이라
   그대로 통과시킨다 — 열이 없다고 전부 버리지 않는다. 탈락은 `closed`.
2. **업종 매핑.** `resolveSbizCategory`가 상권 소분류명 + 상호로 v3.22 업종 12종
   (packages/domain `VENDOR_CATEGORIES`)에 배정한다. 예식장·결혼중개는 업종 이름만으로
   서고, 나머지는 상호에 «웨딩 · 브라이덜 · wedding · bridal»이 있어야 그 업종으로
   **확정**된다.

   확정 못 한 행을 어떻게 할지는 **그 행이 이미 걸러져 왔는지**에 달렸다(`preFiltered`).

   | 경로 | 업종코드로 거르는 자리 | 확정 못 한 행 |
   |---|---|---|
   | OpenAPI (`sbiz-api`) | 있음 — `WEDDING_UPJONG_CODES` | **`etc`로 받는다** |
   | 전국 상권 CSV (`sbiz`) | **없음** — 모든 업종이 한 파일에 | 상호 표시가 없으면 버린다 |

   OpenAPI는 받아올 업종을 코드로 먼저 골랐으므로 거기까지 온 행은 웨딩과 관련
   있다고 보고 버리지 않는다 — **거르는 자리가 분류기에서 수집 목록으로 옮겨간 것이다.**
   전국 CSV는 거르는 자리가 아예 없어서, 같은 규칙을 쓰면 전국 사업자 명부가 통째로
   「기타」로 들어온다. 시험이 그것을 잡는다(「상권 CSV의 일반 미용실·사진관은 자동
   등록하지 않는다」).

   그래서 **코드를 넓히면 그만큼 「기타」가 는다.** 리포트의 `categoryCounts`를 보고
   코드를 조이거나 넓힌다. 한 실행이 쓸 수 있는 양은 `run.ts`의 `MAX_APPLY`가 막는다.
3. **지역 정규화.** 도로명주소 앞 두 토막만 남긴다(`toRegion`). 판정은 도메인
   `regionTokens`를 그대로 쓴다(`isVendorRegion`) — 검색·추천의 지역 비교
   (`regionMatches`)와 규칙이 어긋나면 수집한 region이 화면에서 안 걸린다.
4. **출처 안 중복 제거.** `정규화 상호 | 지역`이 같으면 하나만 남긴다. 탈락은 `duplicates`.

DB 반영(`--apply`) 단계의 보류는 사유를 나눠 센다. 사유 이름은
`structured.vendor_import_holds.reason`(0101)과 같고, 실행 요약의 `heldBy`가 그것을
사유별로 센 것이다.

| 사유 | 뜻 | 검토 대상인가 |
|---|---|---|
| `admin_locked` | 관리자가 잠근 업체라 자동 갱신하지 않음 | 아니오 — 설계대로 |
| `field_conflict` | 값이 달라졌는데 더 최신이라는 근거가 없음 | 예 — 어느 쪽이 맞는지 정해야 한다 |
| `multiple_matches` | 같은 이름·지역에 후보가 둘 이상 | **예 — 지점인지 동명 업체인지 가려야 한다** |
| `ambiguous_name` | 기존 업체·별칭과 이름이 겹침 | **예 — 같은 업체인지 가려야 한다** |
| `insert_conflict` | 넣는 순간 다른 실행이 같은 이름을 넣음 | 예 — 동시 실행 흔적이면 재실행으로 확인 |

**업종 변경은 `field_conflict`에만 남는다.** 업종이 다르면 곧바로 보류로 빠지므로
`vendor_change_log`에는 들어오지 않는다.

수동 검토 큐를 만들지 말지는 `multiple_matches` · `ambiguous_name` 숫자를 실제로 보고
정한다. 합계(`held`)는 `import_runs.held_count`(0210)에, 사유별 내역은
`vendor_import_holds`에 행으로 남는다 — 둘 다 영구 기록이라 7일 만료 산출물이 사라져도
되돌릴 수 있다.

## 레거시 및 제한

기존 LOCALDATA --inspect·--dry-run은 유지한다. 임의 파일의 저장은 차단한다.
새 출처는 sources.ts에 실제 확인한 이용허락·열 정의를 등록한 뒤 테스트한다.
카카오 지오코딩 저장 스크립트는 정책상 차단했다. Google·네이버·카카오 응답을
별도 JSON·해시·감사로그로 저장해 제한을 우회하지 않는다.

실수집 결과와 운영 DB 반영 결과는 별도 *-report.json에 기록하며
PROJECT_STATUS.md에는 실제 확인한 실행 단계만 남긴다.
