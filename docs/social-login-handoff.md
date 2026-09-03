# 소셜 로그인 인수인계

## 현재 구현 상태

- API는 `POST /v1/auth/sessions`에서 `apple`, `kakao` ID Token을 검증한다.
- `GET /v1/auth/providers`는 설정된 제공자만 반환한다.
- 모바일 로그인 화면과 로그인 시트는 API 제공자 목록을 표시한다.
- 모바일 `providers.ts`는 Apple 네이티브 로그인과 Kakao OAuth 흐름을 연결하고, 받은 ID Token을 API로 전송한다.
- Kakao 버튼을 활성화하려면 앱 빌드 환경에 `EXPO_PUBLIC_KAKAO_CLIENT_ID`를 주입해야 한다.
- Kakao 네이티브 OAuth callback은 임의의 `weddingpick://`가 아니라 Kakao가 네이티브 앱 키에 발급한 `kakao<key>://oauth` 스킴을 사용한다. 앱 설정의 Android 패키지명·iOS Bundle ID와 함께 등록해야 한다.
- Google 버튼을 활성화하려면 앱과 API에 `EXPO_PUBLIC_GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_ID`를 주입해야 한다.
- Google ID Token 검증은 공식 규격의 두 issuer(`https://accounts.google.com`, `accounts.google.com`)를 모두 허용한다.
- 네이버는 authorization code를 앱에서 받은 뒤 API 서버가 토큰 교환과 프로필 조회를 수행한다.

## 운영 환경변수

API 서버에만 설정한다. 값은 Git 저장소나 앱 번들에 넣지 않는다.

```env
APPLE_CLIENT_ID=kr.weddingpick.app
KAKAO_APP_KEY=<Kakao REST 또는 OIDC 설정값>
GOOGLE_CLIENT_ID=<Google OAuth client ID>
DEV_LOGIN_SECRET=
NODE_ENV=production
```

`EXPO_PUBLIC_DEV_LOGIN_SECRET`은 운영 빌드에 넣지 않는다.

## 다음 구현 순서

1. API 운영 환경에 `APPLE_CLIENT_ID`, `KAKAO_APP_KEY`, `GOOGLE_CLIENT_ID`를 설정한다.
2. EAS preview/production 환경에 `EXPO_PUBLIC_KAKAO_CLIENT_ID`를 설정한다.
3. Kakao Developers에서 OpenID Connect와 `weddingpick://` Redirect URI를 설정한다.
4. Android/iOS 실기기에서 각각 로그인 테스트한다.
5. 테스트 완료 후 개발용 로그인 코드를 운영 빌드에서 제거한다.

Apple 네이티브 capability와 config plugin은 `app.json`에 반영됐다. Apple 로그인은
현재 iOS 네이티브에서만 활성화한다. Android와 웹에서 Apple 로그인을 제공하려면
별도의 웹 OAuth 흐름을 구현해야 한다.

네이버 실사용 설정은 서버에 `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`, `NAVER_REDIRECT_URIS`를 두고 모바일 EAS 환경에 `EXPO_PUBLIC_NAVER_CLIENT_ID`, `EXPO_PUBLIC_NAVER_REDIRECT_URI`를 둔다. `NAVER_CLIENT_SECRET`은 모바일이나 저장소에 넣지 않는다. Redirect URI는 네이버 Developers에 등록한 값과 세 환경값이 정확히 같아야 하며, 서버 허용목록에 없는 URI는 거부한다.

네이버 Callback URL은 `https://weddingpickl.onrender.com/v1/auth/naver/callback`로 고정한다. 네이버가 HTTPS Callback만 허용하므로 `weddingpick://auth/naver`는 Callback URL에 등록하지 않는다. HTTPS 콜백은 인증 코드와 state를 앱의 커스텀 스킴으로 되돌리고, 앱이 PKCE verifier와 함께 API에서 토큰을 교환한다. 네이버 Client ID는 앱에 포함되는 공개 식별값이며 Client Secret만 GitHub Repository Secret과 Render Secret으로 관리한다.

네이버 제공정보는 통합정책 v3.14 §O에 따라 서비스에 필요한 최소 항목만 요청한다.
식별자는 필수이며, 이름·이메일·별명·프로필 사진·성별·생일·연령대·출생연도·휴대전화번호는
실제 이용 목적과 동의 설정이 확정된 항목만 받는다. API 서버는 반환된 값을
`identity.identities`에 보관하며 앱 DB의 일반 사용자 데이터와 분리한다.

프로필 자동 채움과 재입력 방지 우선순위는 네이버에만 적용하지 않는다. Apple, Kakao,
Google의 검증된 OIDC 표준 클레임(`name`, `nickname`/`preferred_username`, `picture`,
`gender`, `birthdate`, `phone_number`)도 같은 개인정보 영역에 저장한다. 제공자가 주지
않은 값만 추가 입력받고, MY에서 사용자가 직접 수정하거나 비운 값은 소셜 값으로
덮어쓰지 않는다.

Apple 이름은 ID 토큰이 아니라 최초 인증 응답에서 한 번만 제공될 수 있으므로 모바일이
그 응답의 이름을 세션 생성 요청에 함께 보내고 서버가 최초 프로필 기본값으로 보관한다.

## 주의

Apple private key, Kakao client secret, API key는 환경변수/시크릿 저장소로만 관리한다.
