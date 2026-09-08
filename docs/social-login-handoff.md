# 로그인 인수인계

## 정책 — 카카오 1종

핸드오프 v3.12(`docs/design-handoff/current/CHANGELOG.md`)가 로그인 방법을
소셜 4종에서 **카카오 + 이메일**로 줄였고, v3.13(2026-09-07)이 초기 버전을
**카카오만**으로 정했다. 이메일 로그인(WP-AUTH-002~007)은 2026-09-08에 앱 화면·
서버 라우트(`/v1/auth/email/*`)·비밀번호 재설정 메일(Resend)·웹의
`reset-password.html`까지 전부 지웠다 — 메일 발송 인프라는 쓰지 않는다.
**네이버·구글·애플은 화면에서 폐기했다** — 새 로그인 버튼은 어디에도 없다. 다만 이미 그 방법으로 가입한
계정이 실제로 있을 수 있어서, 서버 쪽 검증 코드(`createNaverProvider`·
`createGoogleProvider`·`createAppleProvider`, `apps/api/src/auth/identity-provider.ts`)와
그 계정들의 세션 검증은 그대로 남겨뒀다 — 지우면 그 계정들이 완전히 로그인할
방법을 잃는다. 아래 "폐기된 방법" 절이 그 상태를 설명한다.

## 카카오

- API는 `POST /v1/auth/sessions`에서 `apple`(폐기, 아래 참고) 같은 OIDC id_token
  제공자와 달리 카카오는 **인가 코드**를 받는다 — 카카오 REST API가
  `/oauth/authorize`에서 `response_type=id_token`을 "지원하지 않는 SDK
  버전"(KOE033)으로 거부하기 때문이다. 앱은 네이버가 쓰던 것과 같은 구조
  (`ResponseType.Code` + PKCE)로 인가 코드만 받아 API로 보내고, 서버가
  `https://kauth.kakao.com/oauth/token`으로 교환한 응답의 `id_token`을
  검증한다(`apps/api/src/auth/identity-provider.ts`의 `createKakaoProvider`).
- `EXPO_PUBLIC_KAKAO_CLIENT_ID`(앱)와 `KAKAO_APP_KEY`(서버)는 **같은 값**이어야
  하고, 그 값은 카카오 콘솔 "플랫폼 키"의 **REST API 키**(로그인 리다이렉트
  URI가 등록된 키)다 — 네이티브 앱 키나 JavaScript 키를 넣으면 위 KOE033으로
  거부된다.
- 카카오 콘솔 보안 탭에서 Client Secret을 "사용함"으로 켠 앱만
  `KAKAO_CLIENT_SECRET`이 필요하다.
- 웹 빌드는 `${origin}/login`으로, 네이티브는 Kakao가 그 REST API 키에 발급한
  리다이렉트 URI로 돌아온다 — 두 값 모두 카카오 콘솔 "로그인 리다이렉트
  URI"에 등록해야 한다.

## 폐기된 방법 — 네이버 · 구글 · 애플

새 로그인 버튼은 없다. 아래는 **이미 가입된 계정**의 세션이 계속 검증되도록
남겨둔 코드의 참고용 기록이다 — 새로 설정할 필요는 없다.

- **네이버**: authorization code를 서버가 `/oauth2/token`으로 교환하고
  프로필을 조회한다(`createNaverProvider`). `NAVER_CLIENT_ID` ·
  `NAVER_CLIENT_SECRET` · `NAVER_REDIRECT_URIS`가 설정돼 있어야 기존 계정도
  로그인할 수 있다.
- **구글**: OIDC id_token을 두 issuer(`https://accounts.google.com`,
  `accounts.google.com`) 기준으로 검증한다(`createGoogleProvider`).
  `GOOGLE_CLIENT_ID`는 쉼표로 여러 플랫폼 클라이언트 ID를 함께 허용한다.
- **애플**: OIDC id_token을 검증한다(`createAppleProvider`). `app.json`의
  네이티브 capability·config plugin은 아직 남아 있다 — 지울지는 이번 정책
  범위 밖이라 별도로 판단한다.

## 운영 환경변수

API 서버에만 설정한다. 값은 Git 저장소나 앱 번들에 넣지 않는다.

```env
KAKAO_APP_KEY=<카카오 REST API 키 — EXPO_PUBLIC_KAKAO_CLIENT_ID와 같은 값>
KAKAO_CLIENT_SECRET=<보안 탭에서 Client Secret을 "사용함"으로 켠 경우에만>
DEV_LOGIN_SECRET=
NODE_ENV=production

# 폐기됐지만 기존 계정을 위해 남겨둔 값 — 새로 설정할 필요는 없다.
APPLE_CLIENT_ID=
GOOGLE_CLIENT_ID=
NAVER_CLIENT_ID=
NAVER_CLIENT_SECRET=
NAVER_REDIRECT_URIS=
```

`EXPO_PUBLIC_DEV_LOGIN_SECRET`은 운영 빌드에 넣지 않는다.

## 개인정보 보관

카카오·이메일 각각의 검증된 클레임(이름, 닉네임, 프로필 사진, 성별, 생일,
휴대전화번호 등 제공자가 실제로 준 값만)은 `identity.identities`에 보관하며
앱 DB의 일반 사용자 데이터와 분리한다. 제공자가 주지 않은 값만 추가
입력받고, MY에서 사용자가 직접 수정하거나 비운 값은 로그인 시점 값으로
덮어쓰지 않는다.
