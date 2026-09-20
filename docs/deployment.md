# 배포 운영 기준

## 단일 운영 origin

운영 origin은 `https://210.109.82.212` 하나만 사용한다.

- 사용자 앱: `https://210.109.82.212/login`
- 관리자: `https://210.109.82.212/admin/login`
- API health: `https://210.109.82.212/health`
- API: `https://210.109.82.212/v1/*`

관리자는 별도 포트를 사용하지 않는다. 앱과 관리자는 동일한 immutable static release SHA를 443에서 함께 제공한다.

## main 자동배포

`main` push가 유일한 운영 배포 진입점이다.

1. CI: typecheck, lint, 카피 검사, workspace/API/DB 테스트
2. 정적 변경 감지
3. Expo web export 및 정적 후보 패키징
4. Kakao VM의 `static-releases/<SHA>`에 후보 스테이징
5. 후보 SHA와 현재 `main` SHA 일치 확인
6. `/login`과 `/admin/login`을 같은 443 release로 자동 cutover
7. 외부 runner에서 `/login`, `/admin/login`, `/health`, `/v1/auth/providers` 검증
8. 공개 검증 실패 시 직전 Nginx/release로 자동 rollback

수동 커밋 태그로 앱/관리자 배포를 켜는 절차는 사용하지 않는다.

## API

API는 같은 origin의 `/v1/*`와 `/health`를 127.0.0.1:3001로 proxy한다. 정적 release 전환은 API proxy를 바꾸지 않는다.

DB migration은 별도 변경 범위다. 스키마 변경이 필요한 배포에서는 migration 성공 여부를 코드 배포와 별도로 확인한다.

## 운영 원칙

- Source of Truth: 최신 GitHub `main`
- 배포 대상: KakaoCloud VM
- 앱/관리자 release SHA 불일치 금지
- 관리자 별도 origin/별도 포트 금지
- 정적 후보가 현재 main보다 오래됐으면 공개 전환 금지
- production 비밀값은 출력·커밋·artifact 업로드 금지
- 실패한 공개 검증을 성공으로 간주하지 않는다
