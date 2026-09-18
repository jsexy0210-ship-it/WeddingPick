# Kakao app-web 443 cutover

기존 443 API의 `/health`, `/v1/*` 프록시는 유지하고 나머지 경로에 staged app-web을 공개한다. 공개 검증 실패 시 Nginx 설정을 자동 롤백한다.
