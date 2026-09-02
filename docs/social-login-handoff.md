# 소셜 로그인 인수인계

## 현재 구현 상태

- API는 `POST /v1/auth/sessions`에서 `apple`, `kakao` ID Token을 검증한다.
- `GET /v1/auth/providers`는 설정된 제공자만 반환한다.
- 모바일 로그인 화면과 로그인 시트는 API 제공자 목록을 표시한다.
- 모바일 `providers.ts`는 Apple 네이티브 로그인과 Kakao OAuth 흐름을 연결하고, 받은 ID Token을 API로 전송한다.
- Kakao 버튼을 활성화하려면 앱 빌드 환경에 `EXPO_PUBLIC_KAKAO_CLIENT_ID`를 주입해야 한다.
- Google 버튼을 활성화하려면 앱과 API에 `EXPO_PUBLIC_GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_ID`를 주입해야 한다.
- 네이버 서버 구현 완료: `POST /v1/auth/sessions`에 `provider: 'naver'`로 보내면
  `idToken` 자리에 authorization code를, `state`엔 인가 요청 때 함께 보냈던
  state 값을 넣는다. 서버(`createNaverProvider`, `apps/api/src/auth/identity-provider.ts`)가
  `NAVER_CLIENT_SECRET`으로 네이버 토큰 서버와 직접 교환하고 프로필을 조회한다.
  `NAVER_CLIENT_ID`·`NAVER_CLIENT_SECRET`이 둘 다 설정돼야 제공자 목록에
  나온다 — 운영 환경변수를 아직 넣지 않았으므로 지금은 노출되지 않는다.

## 운영 환경변수

API 서버에만 설정한다. 값은 Git 저장소나 앱 번들에 넣지 않는다.

```env
APPLE_CLIENT_ID=kr.weddingpick.app
KAKAO_APP_KEY=<Kakao REST 또는 OIDC 설정값>
NAVER_CLIENT_ID=<네이버 애플리케이션 Client ID>
NAVER_CLIENT_SECRET=<네이버 애플리케이션 Client Secret>
DEV_LOGIN_SECRET=
NODE_ENV=production
```

`EXPO_PUBLIC_DEV_LOGIN_SECRET`은 운영 빌드에 넣지 않는다.

## 다음 구현 순서

1. API 운영 환경에 `APPLE_CLIENT_ID`, `KAKAO_APP_KEY`를 설정한다.
2. EAS preview/production 환경에 `EXPO_PUBLIC_KAKAO_CLIENT_ID`를 설정한다.
3. Kakao Developers에서 OpenID Connect와 `weddingpick://` Redirect URI를 설정한다.
4. Android/iOS 실기기에서 각각 로그인 테스트한다.
5. 테스트 완료 후 개발용 로그인 코드를 운영 빌드에서 제거한다.

네이버 서버 구현은 끝났다(위 "현재 구현 상태" 참고). `NAVER_CLIENT_ID`,
`NAVER_CLIENT_SECRET`을 운영 환경변수로 넣기 전까지는 제공자 목록에 노출되지
않는다 — 모바일 쪽 네이버 로그인 버튼(authorization code 받아오기,
`weddingpick://` Redirect URI 등록)이 아직 남은 작업이다.

## 주의

Apple private key, Kakao client secret, API key는 환경변수/시크릿 저장소로만 관리한다.
