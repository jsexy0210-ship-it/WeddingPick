# 로그인 인수인계

## v3.12 정책 — 카카오 + 이메일 2종

핸드오프 v3.12(`docs/design-handoff/current/CHANGELOG.md`)가 로그인 방법을
소셜 4종에서 **카카오 + 이메일**로 줄였다. **네이버·구글·애플은 화면에서
폐기했다** — 새 로그인 버튼은 어디에도 없다. 다만 이미 그 방법으로 가입한
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

## 이메일

- API: `POST /v1/auth/email/lookup`(계정 존재 판정) · `POST
  /v1/auth/email/accounts`(가입, 성공 시 바로 세션) · `POST
  /v1/auth/sessions`(`provider: 'email'`로 로그인) · `POST
  /v1/auth/email/password-reset` · `POST
  /v1/auth/email/password-reset/confirm`.
- 비밀번호는 scrypt로 해시한다(`apps/api/src/auth/password.ts`). 원문은 어디에도
  저장하지 않는다.
- 비밀번호 시도는 이메일당 창(기본 15분, `PASSWORD_ATTEMPT_WINDOW_MS`) 안에서
  제한한다(`apps/api/src/auth/attempt-limiter.ts`, 프로세스 메모리 — 인스턴스가
  여럿이면 각자 센다). 오류 문구는 남은 시도 횟수를 숨기지 않는다.
- **비밀번호는 앱에서 재설정하지 않는다.** `/v1/auth/email/password-reset`이
  보내는 메일 링크는 서비스 웹사이트(`apps/web`)의 `reset-password.html`을
  연다 — 모바일 웹 export(`weddingpick-app-web`)가 아니다. 링크는 30분
  유효(`PASSWORD_RESET_TTL_MINUTES`)하고, 재설정에 성공하면 그 계정의 기존
  세션을 전부 끊는다.
- 메일 발송은 `MAIL_DRIVER`로 고른다 — `resend`(운영, `RESEND_API_KEY` ·
  `MAIL_FROM` 필요, 발신 도메인은 Resend 콘솔에서 인증돼 있어야 한다)와
  `console`(개발·스테이징, 보내지 않고 로그에만 찍는다 — 운영에서 이 값이면
  서버가 시작할 때 경고한다).
- 계정 존재 여부를 드러내지 않는다 — 비밀번호 찾기는 등록 여부와 무관하게
  항상 204를 답하고 화면은 늘 "메일을 보냈어요"로 간다. 로그인 실패도 계정이
  없을 때와 비밀번호가 틀렸을 때를 구분하지 않고 같은 401을 준다.

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
MAIL_DRIVER=resend
RESEND_API_KEY=
MAIL_FROM=웨딩픽 <no-reply@weddingpick.kr>
PASSWORD_RESET_URL=https://weddingpick-web.onrender.com/reset-password.html
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
