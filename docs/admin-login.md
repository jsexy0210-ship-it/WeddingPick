# 관리자 로그인 운영 기준

관리자 운영 주소는 하나다.

- 로그인: `https://210.109.82.212/admin/login`
- 홈: `https://210.109.82.212/admin/home`
- API: 같은 origin의 `/v1/admin/*`

## 배포

관리자 화면은 사용자 앱과 같은 Expo web export에서 생성하고, 같은 immutable release SHA를 443에 배포한다.

`main` push 뒤 CI가 성공하면 정적 후보를 Kakao VM에 스테이징하고 사용자 앱과 관리자 경로를 함께 자동 전환한다. 별도 관리자 포트나 별도 관리자 origin을 만들지 않는다.

## 비밀값

관리자 인증 비밀값은 운영 환경에만 둔다. 저장소·로그·artifact에 원문을 기록하지 않는다.

- `ADMIN_PASSWORD`가 있으면 그 값만 사용한다.
- 운영 권장은 원문 대신 `ADMIN_PASSWORD_HASH` 사용이다.
- DB 관리자 계정의 비밀번호도 해시만 저장한다.

## 검증

배포 후 최소 확인:

1. `GET /admin/login` → HTML
2. `GET /health` → `ok=true`, `database=ok`
3. 관리자 로그인 성공/실패
4. 인증 없는 `/v1/admin/*` 접근 차단
5. 관리자 화면에서 사용자 앱 경로로 잘못 이동하지 않음
