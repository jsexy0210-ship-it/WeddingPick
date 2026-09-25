# 앱 아이콘 자산

`seed-icons/`에는 SEED 공식 SVG 25종과 Material Symbols history 대체 SVG 1종이 있습니다. `material-icons/`에는 원본 홈 화면의 Material Symbols 4종이 있습니다. 총 30개 파일입니다.

아이콘 파일을 편집한 뒤 `npm run build:icons` 또는 `npm run build:preview`를 실행합니다. `src/iconAssets.js`는 생성 파일이므로 직접 수정하지 않습니다. SVG는 현재 CSS 색상을 사용하는 `currentColor` 도형이며, 앱에서는 원래 크기·상태색을 유지하는 CSS 마스크로 표시합니다.

`history.svg`가 대체 아이콘인 점을 유지합니다. 파일별 출처 및 라이선스는 `reports/icon-sources.json`, `vendor/NOTICE-Icons.md`에서 확인합니다.

사진 7종만 아직 원본이 없습니다. 승인된 사진을 확보한 뒤 `public/` 아래에 배치하고 `src/assetOverrides.js`의 해당 null에 연결합니다. 폰트 파일은 포함하지 않습니다.
