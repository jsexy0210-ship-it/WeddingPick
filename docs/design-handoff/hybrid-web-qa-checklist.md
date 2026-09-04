# 하이브리드 웹뷰 QA 체크리스트

> `apps/mobile`은 Expo(react-native-web 기반)라서 새 화면을 따로 만들지 않고
> `expo start --web`(`npm run web`) / `expo export --platform web`(`npm run export:web`)로
> 기존 RN 화면을 웹에서 그대로 띄울 수 있다. 이 문서는 **화면을 새로 만드는 기준이
> 아니라, 이미 있는 RN 화면이 웹에서도 정상 동작·정상 디자인인지 점검하는 기준**이다.
>
> 화면 목록·소유권 배분은 이 문서 소관이 아니다 — 작업을 나눌 때는
> `apps/mobile/src/app`의 실제 라우트(파일 기반 라우팅)를 기준으로 그때그때 정한다.
> 이 문서에 특정 화면 목록을 박아두지 않는다 — 라우트는 코드가 바뀌면 같이 바뀌고,
> 여기 박아둔 목록은 낡는다.

## 점검 방법

```bash
cd apps/mobile
npm run web          # 개발 서버, 실제 인터랙션 확인용
npm run export:web   # 정적 빌드, 프로덕션에 가까운 렌더링 확인용
```

브라우저 폭을 모바일(~375px)부터 데스크톱(~1280px+)까지 늘려가며 확인한다.
`packages/ui/src/theme.ts`의 `MaxContentWidth`(800)가 데스크톱 폭에서 콘텐츠를
가운데로 좁혀주는 기준값이다 — 이 값보다 넓어졌을 때 레이아웃이 무한정 늘어지진
않는지 확인한다.

## 점검 항목 (화면 1개당 5개 다 확인)

### 1. 레이아웃 / 반응형
- 모바일 폭에서 정상이던 레이아웃이 데스크톱 폭에서 깨지지 않는가(줄바꿈, 겹침, 잘림).
- `ScrollView`/`FlatList`가 웹에서도 스크롤이 되는가(트랙패드·마우스 휠 포함).
- 고정폭 대신 상대 단위·flex를 쓰고 있는가 — 데스크톱에서 콘텐츠가 화면 전체로
  무한정 늘어지면 `MaxContentWidth`를 적용한다(예: `status-view.tsx`의 패턴 참고).
- `SafeAreaView`/`BottomTabInset`(`theme.ts`)처럼 iOS·Android 노치·탭바를 위해 둔
  여백이 웹에서 불필요한 빈 공간으로 남지 않는가.

### 2. 인터랙션 동작
- `Pressable`/버튼이 웹에서 클릭으로 정상 동작하는가, 클릭 가능한 요소에 `hover`·
  `focus` 상태가 있는가(터치 전용 스타일만 있고 마우스 상태가 없는 곳 확인).
- 폼 입력(텍스트필드, 날짜 선택 등)이 웹 키보드로 정상 입력·포커스 이동되는가.
  네이티브 날짜 피커를 쓰는 화면은 웹에서 대체 UI가 뜨는지, 값이 제대로 반영되는지
  직접 눌러서 확인한다.
- 모달/바텀시트가 웹에서 배경 스크롤을 막고, 닫기 동작(바깥 클릭/ESC 등)이 되는가.

### 3. 텍스트 / 폰트
- 한글 텍스트가 깨지거나 네모(tofu)로 뜨지 않는가 — 웹 폰트 로딩 실패를 특히
  확인한다(`theme.ts`의 `Fonts = Platform.select({...})`가 web 분기 없이 기본값으로
  떨어지는 경우가 있는지 봐야 한다).
- 줄바꿈·자간 때문에 문구가 잘리거나 겹치지 않는가(버튼 라벨, 긴 업체명 등).
- 문구 자체는 `packages/domain/src/copy-rules.ts`의 `BANNED_PHRASES`(표본, 데이터,
  적정가 등)를 새로 만들어 넣지 않았는가 — 화면 수정 중 문구를 건드렸다면 확인.

### 4. 디자인 토큰 / 하드코딩
- 색상·간격·폰트 크기를 직접 하드코딩(`#fff`, `16` 등)하지 않고 `@weddingpick/ui`의
  `theme.ts`(`palette`, `Spacing`, `Layout` 등)·`typography.ts` 값을 쓰는가.
- Pick Mark(`wedding-mark.tsx`)를 변형(리사이즈 비율 왜곡, 색 변경 등) 없이 그대로
  쓰는가.
- mock 데이터·데모 API를 새로 만들지 않고 실제 API(`@/api/client`)를 그대로 쓰는가.

### 5. 플랫폼 분기 누락
- `Platform.select({ ios, android })`처럼 `web` 분기가 빠진 채 기본값(`?? 0`, `??
  undefined` 등)으로 떨어지는 곳이 있는가 — 있다면 웹에 맞는 값을 넣거나, 웹에서도
  네이티브 값이 맞는지 확인 후 의도적으로 두는지 판단한다.
- 네이티브 전용 API(예: `expo-*`의 일부 모듈)를 쓰는 화면은 웹에서 크래시 없이
  graceful하게 동작하거나, 필요한 곳에 `.web.ts`/`.web.tsx` 대체 구현이 있는가
  (`packages/ui/src/use-color-scheme.web.ts` 참고).

## 문제를 찾았을 때

- 고칠 대상은 **RN 화면 소스**(`apps/mobile/src/app/...`, `packages/ui`)다.
  `apps/web`(정적 페이지 빌더, `apps/web/src/*.ts`)은 이 QA와 무관하니 건드리지 않는다.
- 값 하나라도 새로 정할 필요가 생기면 만들어내지 말고 `packages/ui/src/theme.ts` /
  `packages/domain`의 기존 값·통합정책 문서를 먼저 확인한다.
- 커밋·푸시 전 `npm run typecheck --workspace @weddingpick/mobile`, `apps/mobile`에서
  `npx expo lint` 통과를 확인한다.
