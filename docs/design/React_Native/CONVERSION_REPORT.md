# 앱 디자인 React 변환 결과

## 처리 결과

| 항목 | 결과 |
|---|---:|
| React 보드 | 8개 |
| 앱 화면·상태 프레임 | 80개 |
| 반복 템플릿 변환 | 185개 |
| 조건 템플릿 변환 | 60개 |
| JavaScript / JSX 모듈 문법 검사 | 22개, 오류 0개 |
| 포함 SVG 아이콘 | 30종, 화면 연결 완료 |
| SVG 래스터 변환 검사 | 30종, 빈 도형 0개 |
| 공식 SVG 도형 검증 | 30종, 원출처 Git blob SHA 재구성 일치 |
| 아이콘 대체 | history 1종, 명시적 기록 |
| 전체 화면 선택 검사 | 80개, 실패 0개 |
| React 페이지 실행 오류 | 0개 |
| React 콘솔 오류 | 0개 |
| 약관 상세 탭 전환 | 6개, 통과 |
| 검증 중 외부 네트워크 요청 | 0개 |

## 변환 방식

`x-dc`는 React Fragment로, `sc-for`는 배열의 `map`으로, `sc-if`는 조건 렌더링으로 옮겼습니다. `class`와 SVG 속성은 JSX 속성명으로 변환했습니다. 스타일 문자열은 브라우저의 CSS 파서로 읽어 React 스타일 객체로 전달합니다. SVG data URL 안의 세미콜론을 단순 분할하지 않습니다. `image-slot`은 React 이미지 자리 컴포넌트로 치환했습니다. 약관 탭의 `setState`는 React 갱신과 연결했습니다.

템플릿의 문구·예시 데이터·원본 상태 분기는 그대로 유지했습니다. 디자인 정책을 새로 결정하거나 원본의 상충 문구를 임의로 고치지 않았습니다. 캔버스 설명문과 공통 기준에는 예전 용어가 일부 남아 있으므로, 제품 반영 시 최신 정책과 별도 검토해야 합니다.

## 원본에 정의가 없는 스타일

아래 이름은 원본 HTML에 사용되지만 원본 `renderVals()`에서 정의되지 않았습니다. 변환 과정에서 임의의 색상·간격을 만들어 넣지 않았습니다. 값이 없는 스타일로 처리하여 렌더링 중단만 방지했습니다.

| 화면군 | 원본 미정의 스타일 |
|---|---|
| 홈 · 로그인 · 온보딩 | `tagIdWide`, `tagRow`, `tagText` |
| 웨딩노트 | `tagRow`, `tagText` |
| MY · 라운지 · 배우자 | `decidedNote` |

이들은 주로 보드의 화면 번호·설명문 스타일이며, 원본 결손이므로 픽셀 대조 완료 항목으로 처리하지 않습니다.

## 아이콘 보완과 남은 결손

원본 ZIP에 없던 SEED 아이콘 참조 26개 중 25개를 같은 참조명에 대응하는 공식 SVG로 채웠습니다. `history` 1개는 같은 이름의 SEED 파일을 찾지 못해 Material Symbols history SVG로 대체했습니다. 기존 Material Symbols 폰트 표현 4종(storefront, face_retouching_natural, dry_cleaning, diamond)도 공식 SVG로 연결했습니다. 총 30종의 SVG 파일과 데이터 URL 번들을 포함합니다. 기존 인라인 SVG 도형과 Pick Mark는 보존했습니다.

SEED 25종과 Material 5종의 path 데이터를 공식 소스에서 가져왔습니다. 정리한 SVG를 공식 원본 래퍼로 재구성한 Git blob SHA가 조회된 공식 원본 SHA와 일치하는지 확인했습니다. 최종 전달 파일은 래퍼·공백 및 currentColor를 정리했으므로 최종 파일의 해시는 공식 원본 파일의 해시와 다를 수 있습니다. `reports/icon-geometry-check.json`과 `reports/icon-sources.json`을 참조합니다.

사진 7종은 원본 파일이 없어 회색 자리로 유지합니다. 디자인 툴 `support.js`, `image-slot.js`, 디자인 시스템 `_ds/` 의존은 React 변환본에서 제거했습니다. `reports/missing-assets.json`은 업로드 당시 미첨부 상태와 현재 패키지 상태를 별도로 기록합니다. 아이콘은 더 이상 미첨부 상태가 아닙니다.

## 검증 범위와 한계

외부 네트워크를 차단한 Chromium에서 단일 HTML 내용을 주입해 React 18.2.0으로 8개 보드를 렌더링하고, 80개 프레임을 각각 선택해 한 화면만 보이는지 확인했습니다. 전체 보드 전환, 원본 템플릿 문법 잔존 여부, 약관 탭 6개, 600px 브라우저 폭에서 탐색기 표시도 검사했습니다. 이 600px 검사는 디자인 탐색기 검사이며 제품 앱의 반응형·접근성 검증이 아닙니다. 수정 후 SVG 30종의 비어 있지 않은 래스터화, 모든 SVG 마스크의 데이터 URL 연결, Material 아이콘 물음표 제거를 확인했습니다.

이 실행 환경의 file:// 브라우저 탐색은 제한되어 파일 URL을 직접 여는 검사는 수행하지 않았습니다. 동일한 HTML 전체를 브라우저에 주입해 번들 실행과 아이콘 표시를 검사했습니다.

원본 툴의 실행 파일과 자산이 없으므로 원본 도구와의 완전한 픽셀 대조는 수행하지 못했습니다. 네트워크 제한으로 npm 설치 및 Vite 빌드는 실행하지 못했습니다. JSX를 TypeScript 5.8.3으로 컴파일하고 별도 로컬 번들에서 React가 실제 실행되는 것을 검사했습니다.

**검증하지 않은 것:** 실제 로그인, 운영 API, 예약 전송, 파일 업로드, 녹음, 서버 저장, RN 렌더링, iOS/Android 실기기, 접근성 전체, 최신 운영 앱과의 통합.

약관 내용은 원본 시안의 법무 검토 전 문구이며, 이번 변환에서 법적 적합성이나 최신성은 검토하지 않았습니다.

## 추적 파일

`reports/source-map.json`: 원본 파일 SHA-256, JSX·모델 경로, 변환 수량, 원본 미정의 값.

`reports/runtime-check.json`: 프레임 목록, React 실행 검사, 약관 탭 결과, 오류 및 요청 기록.

`reports/syntax-check.json`: 컴파일러 버전, 검사한 JavaScript/JSX 파일과 문법 오류.

`reports/missing-assets.json`: 원본 자산 경로, 사용 화면군, 원본 업로드 상태와 현재 패키지 상태.

`reports/icon-sources.json`: SVG 30종의 공식 출처, 라이선스, history 대체 및 파일 해시.

`reports/icon-geometry-check.json`: 공식 원본 path·속성 데이터의 원본 Git blob SHA 재구성 대조.
