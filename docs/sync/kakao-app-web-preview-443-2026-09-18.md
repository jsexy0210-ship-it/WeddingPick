# Kakao app-web 443 preview

production 환경 승인 규칙은 유지한 채, 이미 staged 된 app-web을 443에 공개해 실제 브라우저 확인만 수행한다. `/health`와 `/v1/*`는 API 프록시를 유지하며 검증 실패 시 자동 롤백한다.
