# 2026-09-10 검수 증거

기준 소스는 `e34193ee1644c664f107d529002ae53ef775389a`다. 저장된 결과는 해당 커밋의 스냅샷이며 이후 변경의 통과 결과가 아니다.

- [계약 재현 결과](admin-contracts.json): 관리자 화면에서 확인한 8개 오류 중 리터럴 서버 응답을 사용하는 5개를 정적으로 재생했다.
- [라우트 대조 결과](admin-routes.json): 정적 후보 목록이다. 동적 URL 등의 오탐 가능성이 있으며 `missing` 개수를 확정 결함 수로 쓰지 않는다.
- [전체 검수와 한계](../../INFORMATION_AUDIT_2026-09-10.md)

저장소에서 `npm ci` 후 다음 명령으로 읽기 전용 진단을 실행한다. 네트워크·DB 요청은 하지 않는다.

```sh
node scripts/audits/admin-contracts.cjs
node scripts/audits/admin-routes.cjs
```

스크립트의 종료 코드 0은 진단 수행 성공이다. 제품 테스트 통과를 뜻하지 않는다. `admin-contracts`는 JSON의 `result`에 재현한 오류를 기록하며, 코드가 달라지면 표본이 낡았다는 오류로 중단할 수 있다. 저장된 JSON을 덮어쓸 때는 새 검수 날짜와 소스 커밋도 함께 기록한다.
