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

**업종코드는 코드에 박지 않는다.** 조회할 업종은 설정에서 온다:

```sh
# 1) 코드 조사 — DB 미반영. 대분류 → 중분류 → 소분류 순으로 좁힌다.
npm run public-data:import --workspace @weddingpick/api -- --lookup-category --level large
npm run public-data:import --workspace @weddingpick/api -- --lookup-category --level small --parent-large <대분류> --keyword 예식

# 2) 확인한 코드로 한 지역만 소량 수집 (--apply 없이)
npm run public-data:import --workspace @weddingpick/api -- --source sbiz-seoul \
  --upjong-div-id indsSclsCd --upjong-codes <코드1>,<코드2> --out ../../.collection
```

`--upjong-codes`(또는 `SBIZ_UPJONG_CODES`)가 비면 수집을 시작하지 않고 실패한다.
어떤 코드가 0건을 돌려주면 그것도 실패로 올린다 — 틀린 코드는 오류 대신 빈 목록으로 오기 때문에
조용한 0건 수집이 예전 `'Q'` 하드코딩에서 실제로 일어났다.
CI에서는 저장소 Variables `SBIZ_UPJONG_CODES`·`SBIZ_UPJONG_DIV_ID`를 읽고, 비어 있으면 sbiz 출처를 건너뛴다.
전국 확대는 이 소량 검증이 끝난 뒤 `sources.ts`에 시도를 추가하는 방식으로 넓힌다.
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

## 레거시 및 제한

기존 LOCALDATA --inspect·--dry-run은 유지한다. 임의 파일의 저장은 차단한다.
새 출처는 sources.ts에 실제 확인한 이용허락·열 정의를 등록한 뒤 테스트한다.
카카오 지오코딩 저장 스크립트는 정책상 차단했다. Google·네이버·카카오 응답을
별도 JSON·해시·감사로그로 저장해 제한을 우회하지 않는다.

실수집 결과와 운영 DB 반영 결과는 별도 *-report.json에 기록하며
PROJECT_STATUS.md에는 실제 확인한 실행 단계만 남긴다.
