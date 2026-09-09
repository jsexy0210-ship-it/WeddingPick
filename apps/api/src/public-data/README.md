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
전국 API는 활용신청·키가 필요하며 이번 구현에는 인증 API 자동 순회가 포함되지 않는다.
CSV 어댑터는 업종명·웨딩 관련 상호로 제한적으로 분류한다. 일반 사진관·미용실은 제외하며,
이 분류도 웨딩 전문성 확정은 아니다. 상가업소번호를 원천 식별키로 쓰고 원본 기준일이
없으면 null을 유지한다. 64 MiB 이하 파일, DB 반영은 실행당 1,000업체 이내로 제한한다.

## 운영 DB 반영

수집 결과 확인 후 같은 명령에 --apply를 추가한다. DATABASE_URL이 필요하다.
0071_vendor_public_sources까지 마이그레이션이 적용돼 있어야 한다.
실제 접속문자열은 문서·터미널 출력에 남기지 말고 기존 GitHub Secrets를 사용한다.

신규 등록과 변경 이력은 같은 트랜잭션이다. 같은 자료 재실행은 업체·감사로그를
중복 생성하지 않는다. 원천 기준일이 더 최신인 동일 출처의 매핑된 업체만 변경한다.
출처 간 충돌·잠금·지점 불명확은 보류한다. 기존 가격 자료의 자동 재매칭은 수행하지 않는다.
현재 CSV에는 확정 폐업 신호가 없어 폐업·재개업 자동 전환을 구현하지 않았다.

## 자동 실행

.github/workflows/public-data.yml이 두 지자체 자료를 매주 일요일 03:17 KST에 수집한다.
PostgreSQL 테스트 통과 후 출처별로 실행하며 main 정기 실행은 DB에도 반영한다.
수동 실행 기본값은 수집만이고 apply를 선택해야 DB를 반영한다. 산출물은 7일 후 만료한다.
로컬 .collection은 같은 이름을 덮어쓰므로 반복 실행으로 누적되지 않는다.
운영 DB의 마이그레이션·Secrets가 없으면 실패로 보고한다.

## 정제 규칙

수집한 행은 아래 순서로 거른다. 각 단계의 탈락 수는 `<source>-report.json`에 따로 남는다
(`closed` · `rejected` · `duplicates`) — 한 칸에 합치면 왜 줄었는지 되돌릴 수 없다.

1. **폐업·휴업 제외.** `localdata.ts`의 영업상태 열(`영업상태명` · `상세영업상태명` ·
   `폐업일자`)을 본다. 열이 아예 없는 «현황» 명단 파일은 폐업 신호가 없는 것이라
   그대로 통과시킨다 — 열이 없다고 전부 버리지 않는다. 탈락은 `closed`.
2. **업종 매핑.** `resolveSbizCategory`가 상권 소분류명 + 상호로 v3.22 업종 12종
   (packages/domain `VENDOR_CATEGORIES`)에 배정한다. 예식장·결혼중개를 뺀 나머지는
   상호에 «웨딩 · 브라이덜 · wedding · bridal»이 있어야 받는다 — 업종만으로는
   일반 미용실·꽃집·여행사를 전부 끌어온다. 업종을 못 골랐는데 상호에 웨딩 표시가
   있으면 버리지 않고 `etc`로 남긴다(수집 결과는 전부 `needs_verification`이라
   사람이 보고 정한다). 상호 표시도 없으면 웨딩과 무관한 행이라 버린다.
3. **지역 정규화.** 도로명주소 앞 두 토막만 남긴다(`toRegion`). 판정은 도메인
   `regionTokens`를 그대로 쓴다(`isVendorRegion`) — 검색·추천의 지역 비교
   (`regionMatches`)와 규칙이 어긋나면 수집한 region이 화면에서 안 걸린다.
4. **출처 안 중복 제거.** `정규화 상호 | 지역`이 같으면 하나만 남긴다. 탈락은 `duplicates`.

DB 반영(`--apply`) 단계의 보류는 사유를 나눠 센다 — `heldBy`가 실행 리포트에 있다.

| 사유 | 뜻 | 검토 대상인가 |
|---|---|---|
| `locked` | `admin_locked` 업체라 자동 갱신하지 않음 | 아니오 — 설계대로 |
| `stale` | 출처 날짜가 기존 값보다 과거이거나 비교 불가 | 아니오 — 설계대로 |
| `ambiguous` | 같은 이름·지역에 여러 행, 또는 기존 별칭과 충돌 | **예 — 사람이 지점·동명 업체를 가려야 한다** |
| `conflict` | 삽입이 고유키에 걸림 | 예 — 동시 실행 흔적이면 재실행으로 확인 |

수동 검토 큐를 만들지 말지는 `ambiguous` 숫자를 실제로 보고 정한다. 합계(`held`)는
`import_runs.held_count`에 남고, 사유별 내역은 실행 산출물 JSON에만 있다(7일 만료).

## 업종 코드 조사 절차 (SBIZ_API_KEY 등록 후)

`collect.ts`의 `downloadSbizApiVendors`는 대분류 `indsLclsCd=Q`로 호출하는데 **`Q`는
확인 전 값이다.** 2026-08-05 승인된 활용가이드의 대분류 코드는 전부 «영문자+숫자» 두
글자(F1 · G2 · I1 · J1 · Q1 …)이고 `Q` 단독도, 웨딩 대분류도 가이드에 없다. 실제 API가
이 값에 빈 결과를 돌려주면 **수집이 조용히 0건이 된다**(오류가 아니라 빈 배열이다).

추측으로 바꾸지 않는다. 키가 등록되면 아래 순서로 확인한다.

```sh
# 1) 대분류 전체를 받아 이름을 눈으로 확인한다. 'Q'가 목록에 있는지부터 본다.
npm run public-data:import --workspace @weddingpick/api -- --lookup-category --level large

# 2) 소분류에서 키워드로 찾는다. 예식 → 결혼 → 웨딩 순으로 각각 돌린다.
npm run public-data:import --workspace @weddingpick/api -- --lookup-category --level small --keyword 예식
```

GitHub Actions로는 `public-data.yml`을 workflow_dispatch로 돌리며 `lookup_keyword`에
`예식`을 넣는다(`lookup-category` 잡이 이때만 돈다). 그 잡은 `--level small`로 고정돼
있으니 1·3번(대분류 · 중분류)은 로컬에서 키를 넣어 돌린다.

확인 순서와 판정 기준:

1. **`--level large`** — `listIndustryCategories('large', key)`. 응답이 비면 `type=json`
   응답 모양이 가정과 다른 것이다(활용가이드가 XML 예시만 준다). 이때는 필드명부터 맞춘다.
2. **`--level small --keyword 예식`** — 소분류명에 «예식»이 든 항목의 `indsSclsCd`를 얻는다.
   `예식장업`이 나오면 그 코드의 앞자리가 우리가 찾는 중·대분류다.
3. **`--level middle --parent-large <대분류코드>`** 로 좁혀 돌려, 2번에서 얻은 소분류가
   실제로 그 아래 달리는지 대조한다. 코드 자릿수(대 2 · 중 4 · 소 6)가 맞물려야 한다.
4. **판정 기준** — 아래 셋이 모두 맞아야 코드 확정이다.
   - 소분류명에 `예식장`이 실제로 있다.
   - 그 소분류의 대분류 코드가 두 글자이고 3번의 중분류와 앞자리가 이어진다.
   - 그 대분류로 `storeListInUpjong`을 1페이지 호출했을 때 `totalCount > 0`이다.
5. 확정된 코드로 `collect.ts`의 `url.searchParams.set('key', 'Q')`와 위 주석을 함께 고친다.
   웨딩 업종이 한 대분류에 모여 있지 않으면 대분류 하나가 아니라 소분류 목록으로
   돌아야 하므로, 그때는 호출 구조 변경을 먼저 보고한다.

`--lookup-category`가 뽑은 코드·이름은 조사용 출력이며 DB에 넣지 않는다.

## 레거시 및 제한

기존 LOCALDATA --inspect·--dry-run은 유지한다. 임의 파일의 저장은 차단한다.
새 출처는 sources.ts에 실제 확인한 이용허락·열 정의를 등록한 뒤 테스트한다.
카카오 지오코딩 저장 스크립트는 정책상 차단했다. Google·네이버·카카오 응답을
별도 JSON·해시·감사로그로 저장해 제한을 우회하지 않는다.

실수집 결과와 운영 DB 반영 결과는 별도 *-report.json에 기록하며
PROJECT_STATUS.md에는 실제 확인한 실행 단계만 남긴다.
