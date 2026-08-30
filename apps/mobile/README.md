# 웨딩픽 모바일 앱

Expo(React Native) 기반 iOS/Android 앱. 서비스의 Primary Product이며, 웹은 소개·다운로드 유도만 담당한다(서비스정책서 9번).

## 실행

```bash
npm install          # 레포 루트에서 (npm workspaces)
npm run mobile       # = expo start
```

Expo Go 또는 개발 빌드에서 QR로 연결한다. `npm run ios` / `npm run android` / `npm run web`도 사용 가능.

## 검사

```bash
npm run typecheck --workspace @weddingpick/mobile
npm run lint --workspace @weddingpick/mobile
npm test --workspace @weddingpick/mobile             # jest-expo
npm run export:web --workspace @weddingpick/mobile   # 번들이 실제로 빌드되는지 확인
```

넷 다 CI에서 돈다. 테스트는 화면이 아니라 규칙을 지키는 로직에 붙였다 — 촬영 draft 순서, 저장 시 등급이 항상 L0인지, 검증 등급의 시장가격 반영 기준(L2 이상), 저장 형식이 깨졌을 때의 동작.

## 테스트용 APK

두 가지 길이 있다. **둘 다 스토어 키가 아니라 테스트 키로 서명된다** — 설치는
되지만 스토어에는 못 올린다.

### GitHub Actions (계정 없이, 권장)

Actions 탭 → `Android APK` → Run workflow. 끝나면 그 실행 화면 맨 아래
Artifacts에 APK가 붙는다.

`api_url` 칸에 API 주소를 넣으면 그 서버에 붙는 빌드가 나온다. 비워두면 서버에
붙지 않는 빌드다 — 촬영과 기기 저장은 되지만 업체 검색·가격은 안 나온다(화면이
그렇다고 적는다).

### EAS Build (Expo 계정 필요)

```bash
npx eas init                                   # 최초 1회. projectId를 app.json에 적어준다
npx eas build --platform android --profile preview
```

`preview` 프로필이 AAB가 아니라 APK를 낸다(`eas.json`). 서버 주소는
`EXPO_PUBLIC_API_URL`로 넣는다.

### 이 레포에서는 왜 못 만드나

개발 환경의 네트워크 정책이 `dl.google.com`을 막아 Android SDK를 받을 수 없다.
`expo prebuild`까지는 되지만(npm에서 받는다) Gradle이 SDK·NDK를 못 받는다.
그래서 APK는 러너에서 만든다.

### 패키지 이름

`kr.weddingpick.app`. **스토어에 처음 올린 뒤에는 바꿀 수 없다** — 첫 배포 전에
한 번 확인하고 넘어간다.

## 구조

```
src/app/                     expo-router 파일 기반 라우팅
  _layout.tsx                루트 Stack + 테마 + Provider + 온보딩 분기
  onboarding.tsx             A-01 온보딩 (첫 실행에만)
  (tabs)/_layout.tsx         Bottom Navigation (홈 | 검색 | 촬영 | 내 웨딩 | MY)
  (tabs)/index.tsx           A-03 홈 — 촬영 CTA + 최근 분석·내 웨딩 요약
  (tabs)/search.tsx          A-16 검색 (Phase 2)
  (tabs)/capture/index.tsx   A-04 촬영 — 입력 방식 선택
  (tabs)/capture/camera.tsx  카메라 연속 촬영
  (tabs)/capture/review.tsx  A-05 문서 확인
  (tabs)/capture/sample.tsx  샘플 미리보기 (서버 없이도 결과 모습을 보여준다)
  (tabs)/capture/analysis/   A-06 분석 중
  (tabs)/capture/result/     A-08 분석 결과 + A-07 확인 단계 + A-09 가격 비교
  (tabs)/wedding/index.tsx   A-11 내 웨딩
  (tabs)/wedding/[id]/       A-12 견적 상세, A-13 인증 등급
  (tabs)/my/index.tsx        A-14 MY
  (tabs)/my/guide.tsx        촬영 방법 + AI 안내
  (tabs)/my/policies.tsx     A-15 약관 및 정책
src/api/                     서버 클라이언트 — 응답을 계약 스키마로 검사한다
src/features/capture/        촬영 흐름 상태, 사진·PDF 선택, 업로드
src/features/quotes/         분석 결과 렌더링 (실제 결과와 샘플이 함께 쓴다)
src/features/sample/         샘플 미리보기 고정 데이터
src/features/documents/      기기에 저장된 문서 묶음
src/features/verification/   검증 등급 L0~L4 정의
src/features/onboarding/     온보딩 완료 여부
src/components/              공용 컴포넌트
src/constants/theme.ts       색상·간격·폰트 토큰
src/hooks/                   테마·색상 스킴 훅
types/expo.d.ts              expo 타입 참조 (CI에서 expo-env.d.ts가 생성되지 않으므로 직접 둠)
```

화면 ID(A-03 등)와 각 화면이 담을 내용은 [docs/05-product-spec.md](../../docs/05-product-spec.md) 2번 표를 따른다. 검색(A-16)만 아직 `ScreenPlaceholder`를 렌더링한다 — Phase 2 화면이라서다. 실제 화면이 붙으면 해당 사용을 지운다.

## 촬영 흐름

카메라 촬영 / 사진 불러오기 / PDF 불러오기 세 경로 모두 `CaptureDraft`(`src/features/capture/capture-draft.tsx`)에 장을 쌓고 A-05에서 확인한다. 화면을 넘나들며 장을 더하고 빼므로 화면 상태가 아니라 흐름 단위 상태로 두었다.

서버 주소(`EXPO_PUBLIC_API_URL`)가 있으면 "분석 시작"이 뜬다. 없으면 기기 저장까지만 된다.

**실제 사용자 문서를 서버로 보내는 것은 원본 문서 처리에 대한 법률 자문이 끝난 뒤다**(docs/05 6번).
지금 서버 연결은 개발용이다.

## 저장

"내 웨딩에 저장"을 누르면 `src/features/documents/storage.ts`가 문서 묶음을 기기에 남긴다.

- 메타데이터는 AsyncStorage에 JSON 한 덩어리로. 건수가 많아지면 SQLite로 옮긴다.
- 원본 파일은 촬영 직후 캐시에 있어 시스템이 지울 수 있으므로, 앱 문서 디렉터리(`originals/<묶음 id>/`)로 복사한다.
- 웹에서는 파일시스템을 쓰지 않고 원본 URI를 그대로 둔다. 화면 확인용이며 새로고침하면 blob URI가 끊긴다.

서버 보관기간과 원본 자동삭제(`retentionUntil`)는 기준이 확정되지 않아 아직 넣지 않았다.

## 서버 연결

```bash
EXPO_PUBLIC_API_URL=http://localhost:3000 \
EXPO_PUBLIC_DEV_LOGIN_SECRET=development-only-secret \
npm run mobile
```

`src/api/client.ts`는 받은 응답을 **계약 스키마로 검사한 뒤에만** 쓴다. 서버가 계약을
어기면 화면이 이상한 값을 그리기 전에 여기서 걸린다 — 표본 수 없이 중앙값만 담긴
비교 응답은 통과하지 못한다.

`EXPO_PUBLIC_DEV_LOGIN_SECRET`은 개발 빌드 전용이다. EXPO_PUBLIC_* 값은 번들에 그대로
들어가므로 배포 빌드에는 절대 넣지 않는다. Apple·Kakao 로그인이 붙으면 이 경로는 지운다.

## 샘플 미리보기와 안내

- **샘플 미리보기**(`capture/sample.tsx`) — 견적서를 올리기 전에 결과가 어떤 모습인지
  보여준다. 실제 결과 화면과 **같은 컴포넌트**로 그려서, 샘플이 실제와 다른 약속을 하지
  않는다. 화면 위와 헤더에서 샘플임을 계속 알린다 — 지어낸 숫자이고 실제 업체·계약이 아니다
- **안내 페이지**(`my/guide.tsx`) — 촬영 요령과 AI 안내. 법률검토 체크리스트의
  "AI 안내 정책"에 해당하는 소비자 고지다. AI가 무엇을 하고 무엇을 보장하지 않는지,
  개인정보를 어떻게 다루는지 적었다. **법률 검토 전 초안이다**

## 주의

- 탭 라벨 "내 웨딩"은 배우자 연결(Phase 3) 이후 "우리 웨딩"으로 바뀐다.
- npm workspaces 구성이라 Metro가 루트 `node_modules`를 보도록 `metro.config.js`에서 `watchFolders`를 설정해 두었다.
- 이 환경에서는 `npx expo install`이 Expo API에 접근하지 못하므로 패키지 추가 시 `npm install`을 쓰고, 버전은 SDK 57 호환 여부를 직접 확인한다.
- 카메라·사진·PDF는 네이티브 모듈이라 Expo Go로는 권한 동작이 다를 수 있다. 정확한 확인은 개발 빌드(`npx expo run:ios` / `run:android`)에서 한다.
