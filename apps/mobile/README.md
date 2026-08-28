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
npm run export:web --workspace @weddingpick/mobile   # 번들이 실제로 빌드되는지 확인
```

셋 다 CI에서 돈다.

## 구조

```
src/app/                     expo-router 파일 기반 라우팅
  _layout.tsx                루트 Stack + 테마 + 촬영 draft Provider
  (tabs)/_layout.tsx         Bottom Navigation (홈 | 검색 | 촬영 | 내 웨딩 | MY)
  (tabs)/index.tsx           A-03 홈
  (tabs)/search.tsx          A-16 검색 (Phase 2)
  (tabs)/capture/index.tsx   A-04 촬영 — 입력 방식 선택
  (tabs)/capture/camera.tsx  카메라 연속 촬영
  (tabs)/capture/review.tsx  A-05 문서 확인
  (tabs)/wedding.tsx         A-11 내 웨딩
  (tabs)/my.tsx              A-14 MY
src/features/capture/        촬영 흐름 상태와 사진·PDF 선택
src/components/              공용 컴포넌트
src/constants/theme.ts       색상·간격·폰트 토큰
src/hooks/                   테마·색상 스킴 훅
types/expo.d.ts              expo 타입 참조 (CI에서 expo-env.d.ts가 생성되지 않으므로 직접 둠)
```

화면 ID(A-03 등)와 각 화면이 담을 내용은 [docs/05-product-spec.md](../../docs/05-product-spec.md) 2번 표를 따른다. A-04·A-05를 뺀 나머지 탭은 아직 `ScreenPlaceholder`만 렌더링하며, 실제 화면이 붙으면 해당 사용을 지운다.

## 촬영 흐름

카메라 촬영 / 사진 불러오기 / PDF 불러오기 세 경로 모두 `CaptureDraft`(`src/features/capture/capture-draft.tsx`)에 장을 쌓고 A-05에서 확인한다. 화면을 넘나들며 장을 더하고 빼므로 화면 상태가 아니라 흐름 단위 상태로 두었다.

**문서는 아직 기기 밖으로 나가지 않는다.** 업로드는 원본 문서 처리에 대한 법률 자문이 끝난 뒤에 붙인다(docs/05 6번). 앱을 닫으면 draft는 사라진다 — 로컬 저장도 아직 없다.

## 주의

- 탭 라벨 "내 웨딩"은 배우자 연결(Phase 3) 이후 "우리 웨딩"으로 바뀐다.
- npm workspaces 구성이라 Metro가 루트 `node_modules`를 보도록 `metro.config.js`에서 `watchFolders`를 설정해 두었다.
- 이 환경에서는 `npx expo install`이 Expo API에 접근하지 못하므로 패키지 추가 시 `npm install`을 쓰고, 버전은 SDK 57 호환 여부를 직접 확인한다.
- 카메라·사진·PDF는 네이티브 모듈이라 Expo Go로는 권한 동작이 다를 수 있다. 정확한 확인은 개발 빌드(`npx expo run:ios` / `run:android`)에서 한다.
