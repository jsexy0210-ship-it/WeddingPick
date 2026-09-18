# Kakao admin + website 443 preview

8443/9443 Security Group가 닫힌 동안 443의 임시 확인 경로로 관리자와 웹사이트를 노출한다. API `/health`, `/v1/*`는 그대로 유지하고 공개 검증 실패 시 이전 Nginx 설정으로 자동 롤백한다.
