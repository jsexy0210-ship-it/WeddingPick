# 개발 인계

디자인 기준은 `docs/design/` 하나입니다. 이 경로 외 폐기된 디자인 경로를 참조하거나 복구하지 않습니다.

## 읽는 순서

1. `README.md`와 `CONVERSION_REPORT.md`에서 범위와 결손을 확인합니다.
2. `preview.html`에서 해당 화면을 선택해 실제 상태를 확인합니다.
3. `reports/runtime-check.json`에서 화면 ID·원본 행 번호를 찾습니다.
4. 해당 `src/boards/*.jsx`와 `src/models/*.js`를 함께 읽습니다.
5. 아이콘은 `public/assets/`와 `src/iconAssets.js`에 이미 포함되어 있습니다. 원본 사진 7종만 `src/assetOverrides.js`의 매핑을 채웁니다.
6. 아이콘 수정 후 `npm run build:preview`로 재생성합니다. `history.svg` 1종의 대체 내역은 `reports/icon-sources.json`에서 확인합니다.

## 제품 코드에 반영할 때

이 패키지의 사이드바·상단 도구·휴대전화 바깥의 화면 번호·캔버스 설명은 디자인 탐색기이며 제품 앱 UI가 아닙니다. 휴대전화 프레임의 고정 폭·높이·상태바·라운드는 레퍼런스 표현입니다. 실제 앱에는 해당 기기의 안전 영역과 기존 화면 컨테이너를 사용해야 합니다.

원본에 없는 화면 이동·입력 저장·예약 전송을 동작한다고 가정하지 않습니다. 약관 탭 외 대다수 상태는 디자인 시안입니다. 기존 제품의 인증·라우팅·API·상태 연결은 별도로 유지하고 검증합니다.

React Native 작업은 `View`/`Text`/`Pressable`/`StyleSheet` 등의 별도 네이티브 이식 작업입니다. 이 패키지의 React DOM 컴포넌트를 RN 완료본으로 간주하지 않습니다. 원본 결손과 실제 변환 오류를 구분하고, 미검증 항목을 완료로 보고하지 않습니다.
