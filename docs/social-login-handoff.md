# 소셜 로그인 인수인계

## 현재 구현 상태

- API는 `POST /v1/auth/sessions`에서 `apple`, `kakao` ID Token을 검증한다.
- `GET /v1/auth/providers`는 설정된 제공자만 반환한다.
- 모바일 로그인 화면과 로그인 시트는 API 제공자 목록을 표시한다.
- 모바일의 `providers.ts`는 현재 개발용 로그인 토큰만 실제 전송하며, Apple·Kakao SDK 연결은 아직 필요하다.

## 운영 환경변수

API 서버에만 설정한다. 값은 Git 저장소나 앱 번들에 넣지 않는다.

```env
APPLE_CLIENT_ID=kr.weddingpick.app
KAKAO_APP_KEY=<Kakao REST 또는 OIDC 설정값>
DEV_LOGIN_SECRET=
NODE_ENV=production
```

`EXPO_PUBLIC_DEV_LOGIN_SECRET`은 운영 빌드에 넣지 않는다.

## 다음 구현 순서

1. 모바일에 Apple Sign in과 Kakao OAuth를 연결한다.
2. 콜백에서 받은 ID Token을 `/v1/auth/sessions`로 전달한다.
3. 로그인 취소·실패·재시도 상태를 처리한다.
4. Apple Developer의 Bundle ID와 Sign in with Apple을 확인한다.
5. Kakao Developers의 네이티브 앱 키·동의항목·Redirect URI를 설정한다.
6. Android/iOS 실기기에서 각각 로그인 테스트 후 개발용 로그인 코드를 제거한다.

## 주의

Apple private key, Kakao client secret, API key는 환경변수/시크릿 저장소로만 관리한다.
