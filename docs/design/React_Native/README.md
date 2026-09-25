# WeddingPick 앱 디자인 · React 변환본 v3.29 / 아이콘 보완판 3.29.1

**디자인 기준 경로는 `docs/design/` 하나입니다.** 이 패키지는 업로드된 `웨딩픽_프로젝트.zip`의 앱 디자인을 React JSX로 옮긴 **디자인 레퍼런스**입니다. 앱의 운영 코드나 React Native 네이티브 빌드가 아닙니다.

## 바로 확인

`preview.html`을 브라우저에서 엽니다. 설치나 외부 네트워크 없이 React 18.2.0이 실행됩니다. 왼쪽에서 화면군과 화면을 선택하고, `화면 하나` / `전체 보드`, 배율, 화면 검색을 사용할 수 있습니다. 원본의 화면 폭·높이를 유지한 디자인 미리보기이므로 화면 배율을 줄이면 전체를 보기 쉽습니다.

앱 화면·상태 프레임 **80개**, 추가 기준 보드 **2개**를 포함합니다. 앱 약관 상세의 6개 탭은 실제로 전환됩니다. 나머지 버튼·입력·예약·녹음 등은 원본의 디자인 상태 표현이며, 원본에 없는 제품 동작을 추가하지 않았습니다.

## 업로드 위치

ZIP은 `docs/design/`를 루트 하위 경로로 담고 있습니다. 저장소 루트 기준으로 이 경로를 유지하여 압축을 푼 다음 파일을 올립니다. 저장소의 최상위 `package.json`에 이 패키지의 `package.json`을 덮어쓰지 않습니다.

기존 폐기 경로를 만들거나 복구하지 않습니다. GitHub 업로드, 기존 파일 삭제, 운영 배포는 이 작업에서 수행하지 않았습니다.

## 포함 범위

| 화면군 | 편집할 React 파일 | 화면·상태 프레임 |
|---|---|---:|
| 홈 · 로그인 · 온보딩 | `src/boards/home.jsx` | 15 |
| 검색 · 업체 상세 | `src/boards/search.jsx` | 11 |
| Pick · 비교 · 상담 예약 | `src/boards/pick.jsx` | 5 |
| 웨딩노트 | `src/boards/note.jsx` | 9 |
| MY · 라운지 · 배우자 | `src/boards/my.jsx` | 22 |
| 공통 UI · 빈 상태 · 로더 | `src/boards/common.jsx` | 18 |
| 앱 컴포넌트 기준 | `src/boards/components.jsx` | 기준 보드 |
| 앱 디바이스 대응 | `src/boards/devices.jsx` | 기준 보드 |

포함된 앱 약관은 홈의 가입 동의·상세 및 MY의 약관 보기입니다. 별도 `웨딩픽 약관 방침` 파일은 관리자 편집 도구이므로 제외했습니다.

**제외:** 랜딩 2종, 관리자 2종, 약관 관리자, 스토어 홍보 이미지, 혼합 전체 IA, 기존 사용자 흐름 문서. 제외된 파일의 실행 코드나 화면은 패키지에 들어 있지 않습니다.

## 파일 구조

```text
docs/design/
  README.md
  CONVERSION_REPORT.md
  HANDOFF.md
  preview.html                 설치 없이 실행하는 React 미리보기
  index.html                   Vite 개발 진입점
  package.json
  vite.config.js
  src/
    App.jsx                    디자인 탐색기
    main.jsx
    boards/                    앱 디자인 JSX 8개
    models/                    원본의 데이터·스타일·상태 분기
    runtime/designRuntime.js   CSS 객체 변환·이미지 누락 처리·상태 연결
    assetOverrides.js          아이콘 자동 연결·미첨부 사진 매핑
    iconAssets.js              SVG에서 생성한 데이터 URL 모듈
    designMetadata.js
    source-styles.css
    preview.css                탐색기 전용 스타일
  reports/                     원본 매핑·누락·검증 결과
  public/assets/seed-icons/    25종 SEED SVG + history 대체 SVG
  public/assets/material-icons/ 4종 Material SVG
  icon-gallery.html            SVG 30종 상태색 미리보기
  scripts/build-icons.cjs
  scripts/build-preview.cjs
  vendor/                      단일 미리보기용 React 런타임·라이선스
```

## 소스를 수정하며 실행

```bash
cd docs/design
npm install
npm run dev
```

`npm run build`는 Vite 결과물을 `dist/`에 만듭니다. `npm run build:preview`는 현재 소스로 설치 없는 단일 `preview.html`을 다시 만듭니다.

이 전달본에서 JSX 컴파일과 단일 HTML의 React 실행은 검증했습니다. npm 레지스트리 접근이 막혀 `npm install` 및 Vite 빌드는 실행하지 못했습니다. 실행하지 않은 검증을 통과로 표시하지 않았습니다.

## 아이콘 포함 및 연결

이번 보완판에는 **SVG 아이콘 30종**을 실제 파일로 넣고 앱 화면에 연결했습니다. SEED 공식 25종, Material Symbols 공식 5종입니다. 기존 인라인 SVG와 Pick Mark는 그대로 유지했습니다. Material Symbols는 아이콘 폰트 대신 SVG 마스크로 표시하므로 외부 폰트 요청이 없습니다.

`history.svg`는 같은 이름의 SEED 파일을 찾지 못해 Google Material Symbols의 history SVG로 대체했습니다. 1종의 대체 내역은 `reports/icon-sources.json`에 표시했습니다. 나머지 SEED는 원본 참조명에 대응하는 공식 SVG입니다. 원본 ZIP에 없던 아이콘 파일의 바이너리를 복구한 것으로 주장하지 않습니다.

아이콘의 원본 파일은 `public/assets/`에 있습니다. 수정 후 `npm run build:icons`를 실행하면 `src/iconAssets.js`가 갱신됩니다. `npm run dev`, `npm run build`, `npm run build:preview`도 아이콘 번들을 먼저 생성합니다. 단일 `preview.html`에는 아이콘 데이터가 내장됩니다. `icon-gallery.html`에서도 30종을 확인할 수 있습니다.

아이콘 출처·라이선스는 `reports/icon-sources.json`, `vendor/NOTICE-Icons.md`, `vendor/LICENSE-Icons-Apache-2.0.txt`에 있습니다. 폰트 파일은 포함하지 않습니다.

## 남아 있는 원본 결손

원본 사진 **7종**은 업로드 ZIP에 없어 여전히 회색 이미지 자리로 남아 있습니다. 승인되지 않은 사진으로 임의 교체하지 않았습니다. 실제 사진은 `public/` 아래에 두고 `src/assetOverrides.js`의 해당 `null`에 URL 또는 데이터 URL을 연결합니다. 외부 파일 URL을 연결한 경우에는 단일 HTML에 자동 내장되지 않습니다.

원본 디자인 도구·디자인 시스템 결손과 미정의 스타일은 `CONVERSION_REPORT.md` 및 `reports/`에 구분했습니다. 아이콘 보완이 원본 전체의 픽셀 일치나 운영 앱 통합 완료를 의미하지는 않습니다.
