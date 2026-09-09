# 구글 플레이 스토어 등록정보 — 초안 (2026-09-09)

콘솔의 「앱 설정 완료 → 스토어 등록정보」에 넣을 값이다. **문구는 `spec/strings.ko.json`의
승인된 표현만 쓴다** — 새 말을 지어내지 않았고, 금지어(`AI` · `데이터` · `탐색` · `관심업체` ·
`확인된 제보`)와 애매모호 표현을 넣지 않았다. `node lint-copy.js docs/store-listing-ko.md`가 통과한다.

## 1. 그대로 넣는 값

| 칸 | 값 | 출처 |
|---|---|---|
| 앱 이름 | 웨딩픽 | `apps/mobile/app.json` `expo.name` |
| 패키지 이름 | `kr.weddingpick.app` | `apps/mobile/app.json` `expo.android.package` |
| 기본 언어 | 한국어 — ko-KR | 서비스가 한국어 전용 |
| 앱 또는 게임 | 앱 | — |
| 유료 또는 무료 | 무료 | 앱 자체는 무료 |
| 연락처 이메일 | `help.weddingpick@gmail.com` | 사용자 지정. 이용약관 21조 · 개인정보처리방침 11조와 같은 주소 |
| 개인정보처리방침 | `https://weddingpick-web.onrender.com/privacy.html` | `packages/domain/src/policies.ts` |

**개인정보처리방침 상태를 먼저 확인해야 한다.** `policies.ts:36`이 그 문서를 「초안 게시 ·
법률 자문을 마친 초안, 확정 전 내용으로 바뀔 수 있음」으로 표시한다. 구글에 제출하는 주소이므로
확정본인지 사람이 판단한다.

## 2. 간단한 설명 (80자 이내)

```
웨딩홀부터 스드메까지 찾고 비교하고, 마음에 들면 Pick. 준비 일정도 함께 정리해요.
```
45자. `webLanding.metaDescription` · `footerTag`를 줄인 것이다.

## 3. 자세한 설명 (4000자 이내)

```
웨딩픽은 내 조건에 맞는 곳을 찾고 비교해 Pick하는 웨딩 준비 앱이에요.

■ 찾기
웨딩홀 · 스튜디오 · 드레스 · 메이크업 · 본식스냅 · 부케 · 청첩장 · 예물 ·
혼수 · 허니문 · 헤어변형 · 결정사까지, 준비에 필요한 업종을 한곳에서 봐요.
지역과 예산으로 좁혀서 볼 수 있어요.

■ 금액 비교
업체마다 금액 구간을 함께 보여드려요. 앞서 계약한 분들이 남긴 실 제보를 모아
구간과 기준금액을 만들어요. 몇 건을 모았는지, 어느 기간의 값인지 함께 적어요.
실 제보가 아직 적은 곳은 업체가 안내한 금액을 대신 보여드리고, 그 사실을 밝혀요.
업체가 안내한 정보와 이용자가 남긴 정보를 구분해 보여드려요.

■ Pick
마음에 드는 곳을 Pick해두면 다시 찾아다니지 않아도 돼요.
Pick한 곳의 중요한 정보를 한눈에 비교하고, 업종마다 한 곳을 정해요.

■ 함께 준비하기
배우자와 서로 Pick한 곳을 보고 준비 일정도 함께 정리해요.
혼자서도 이용할 수 있어요.

■ 준비 현황
예식일까지 남은 날과 업종별 진행 상태를 홈에서 봐요.
다음에 정할 업종을 먼저 알려드려요.

■ 지출 관리
업종마다 얼마를 썼는지 기록하고 예산과 견줘 봐요.

최종 금액과 예약 가능 여부는 업체에 확인해주세요.

문의 help.weddingpick@gmail.com
```
공백 포함 약 560자.

## 4. 그래픽 · 스크린샷

| 항목 | 규격 | 상태 |
|---|---|---|
| 앱 아이콘 | 512×512 PNG | **있다** — `docs/store-assets/android/icon-512.png`. 앱 아이콘 원본(`apps/mobile/assets/images/icon.png` 1024)과 같은 도안임을 픽셀 비교로 확인했다(차이가 마크 외곽선에만, 배경 완전 일치). 새로 뽑을 이유가 없다 |
| 그래픽 이미지 | 1024×500 | **없다** — `docs/` 전체에 그 규격 파일 0건. 도안이 정해지지 않았다(7절) |
| 휴대전화 스크린샷 | 최소 2장 · 최대 8장 · 16:9 또는 9:16 | 저장소에는 **2장**뿐이다(`docs/store-assets/android/01-hero.png` · `02-recommend.png`, 각 1080×1920). 최소 요건은 넘는다. 캡처해 둔 6장 중 나머지 4장은 저장소 밖에 있다 |

iOS용은 `docs/store-assets/ios/`에 따로 있다(아이콘 1024×1024, 스크린샷 1290×2796 2장).

## 5. 구글에 신고하는 항목 — 틀리면 나중에 앱이 내려간다

| 항목 | 답할 값 | 근거 |
|---|---|---|
| **앱 액세스 권한** | **제한됨 — 로그인이 필요하다.** 심사자용 접속 방법을 제공해야 한다 | 카카오 로그인 없이는 화면을 볼 수 없다(`apps/mobile/src/app/_layout.tsx`) |
| 광고 포함 | 없음 | 광고 실운영 전환은 아직 하지 않았다(CLAUDE.md 「진행 상태」) |
| 타겟층 | 만 14세 이상 | 로그인 화면의 연령 확인 |
| 콘텐츠 등급 | 설문으로 결정 | — |
| 데이터 안전 | **아래 6절 참조** | 권한 실사용을 코드로 확인했다(2026-09-09). 신고할 것과 지울 것이 갈렸다 |

**앱 액세스 권한을 빠뜨리면 반려된다.** 심사자가 들어갈 수 없으면 앱을 볼 수 없기 때문이다.
테스트 계정을 주거나, 로그인 없이 볼 수 있는 경로를 안내해야 한다.

## 6. 데이터 안전 — 코드로 확인한 것 (2026-09-09)

`app.json`이 선언한 권한을 실제 사용처와 대조했다.

| 권한 | 실제로 쓰는가 | 처리 |
|---|---|---|
| `CAMERA` | 쓴다 — `apps/mobile/src/app/(tabs)/capture/camera.tsx` | 남긴다. 데이터 안전에 신고 |
| `RECORD_AUDIO` | 0건 | **지웠다** (#148) |
| `ACCESS_COARSE_LOCATION` | 0건 — `expo-location` 의존성 자체가 없다 | **지웠다** (#148, 지도 보기 보류 결정과 일치) |
| `ACCESS_FINE_LOCATION` | 0건 — 위와 같다 | **지웠다** (#148) |
| `SYSTEM_ALERT_WINDOW` | 0건 — `canDrawOverlays` · `TYPE_APPLICATION_OVERLAY` 참조 없음 | **막았다** (#153) |
| `VIBRATE` | 확인함 | **둔다.** 민감 권한이 아니고 데이터 안전 신고 항목도 아니며 `expo-notifications`가 알림 진동에 쓸 수 있다 |

**빌드 산출물로 확인을 마쳤다(추정 아님).** `npx expo prebuild --platform android --clean` 후
`android/app/src/main/AndroidManifest.xml`을 직접 읽었고, 두 가지가 드러났다.

- `app.json`의 `permissions`에서 세 줄을 지우자 위치 둘은 사라졌으나 **`RECORD_AUDIO`는 남았다.**
  `expo-image-picker`의 config plugin이 `microphonePermission`을 `false`로 주지 않으면 되넣는다
  (`node_modules/expo-image-picker/plugin/build/withImagePicker.js` L11-13). 같은 플러그인이 `false`일 때는
  차단까지 스스로 걸어 주므로(L16-19) `app.json`에 그 옵션을 줘서 껐다.
- `SYSTEM_ALERT_WINDOW`는 어느 플러그인도 아닌 **expo의 기본 매니페스트 템플릿**에서 나온다
  (`@expo/config-plugins/build/plugins/withAndroidBaseMods.js` L54-62). 끌 옵션이 없어
  `android.blockedPermissions`로 막았다. 앱의 `main` 소스셋에 있으므로 디버그 전용이 아니고
  릴리즈 AAB에 그대로 실린다 — 라이브러리의 debug 매니페스트만 보고 판정하면 틀린다.

**최종 AAB에 실리는 권한은 `CAMERA` · `INTERNET` · `READ/WRITE_EXTERNAL_STORAGE` · `VIBRATE` 넷이다.**
심사에서 설명하지 못할 권한은 남아 있지 않다.

### 제3자 공유 — 반드시 신고한다

**이용자가 올린 문서 이미지가 Anthropic API로 전송된다.**
`apps/api/src/analysis/claude-analyzer.ts` · `apps/api/src/analysis/claude-payment-reader.ts`가 그 경로다.
구글 데이터 안전 양식에서 이것은 «수집»이 아니라 **«제3자와 공유»**에 해당한다. 빠뜨리면
나중에 앱이 내려간다. 무엇을 · 언제 · 어느 화면에서 보내는지 목록을 만든 뒤 사람이 문구를 정한다.

---

## 7. 첫 AAB를 올리기까지 — 순서

앞 절들이 「무엇을 넣는가」라면 이 절은 「어떤 차례로 하는가」다. 위에서부터 막힌 것을 풀어야
다음이 열린다.

| # | 할 일 | 누가 | 상태 |
|---|---|---|---|
| 1 | 스토어 등록정보 채우기(1~5절 값) | 사용자 | 콘솔 작업. 이 문서가 값을 다 갖고 있다 |
| 2 | Play Console → 설정 → **API 액세스** → 서비스 계정 생성 → JSON 키 발급 | 사용자 | **미완** |
| 3 | Play Console → 사용자 및 권한 → 그 서비스 계정에 「릴리스 관리자」 부여 | 사용자 | **미완** |
| 4 | `cd apps/mobile && eas credentials` → Android → Google Service Account 등록 | 사용자 | **미완** |
| 5 | AAB 빌드 — `release.yml` 수동 실행(`platform: android`) | — | 2~4가 끝나야 제출이 붙는다 |
| 6 | 비공개 테스트 버전 게시 | 사용자 | 1번이 끝나야 열린다 |
| 7 | 테스터 12명이 각자 «참여 선택»을 누름 | 사용자 | **여기서부터 14일 시계가 돈다** |
| 8 | 14일 연속 실행 → 프로덕션 액세스 신청 → 심사 | 사용자 | 줄일 수 없는 기간 |

**JSON 키는 저장소에 커밋하지 않는다.** `release.yml`도 키 파일을 다루지 않는다 — EAS에 등록된
자격을 `EXPO_TOKEN`으로 꺼내 쓴다.

**versionCode는 사람이 올리지 않는다.** `eas.json`의 `cli.appVersionSource`가 `remote`이고
`build.production.android.autoIncrement`가 `versionCode`라 EAS 서버가 번호를 관리한다(#141).
이 설정이 없으면 매 빌드가 versionCode 1로 나와 두 번째 업로드부터 거부된다.
다만 같은 설정이 iOS `buildNumber` 관리도 remote로 바꾸므로, `app.json`의 `buildNumber: "2"`와
어긋나지 않는지 **첫 iOS 빌드에서 확인해야 한다 — 미확인이다.**

**제출은 `submit` 입력을 켰을 때만 나간다.** `release.yml`의 `submit-android` 잡이
`inputs.submit == true`를 함께 보므로, 빌드만 하고 스토어에 올리지 않을 수 있다.
트랙을 지정하지 않아 EAS 기본값인 **internal 트랙**으로 올라간다.

### 배포 상태를 GitHub 초록으로 판단하지 않는다

`main.yml`의 Deploy 잡은 Render 배포 결과를 읽지 않는다. `/health`가 200이면 통과인데,
새 빌드가 취소돼도 **이전 빌드가 계속 200을 돌려주므로** 잡은 초록으로 끝난다. 즉 이 초록은
「서버가 살아 있다」는 뜻이지 「이 커밋이 배포됐다」는 뜻이 아니다.

배포 여부는 `render-deploy-status.yml`을 돌려 최신 deploy의 `status`와 `commit`을 보고 말한다
(`scripts/render-deploy-status.py`가 `/services/{id}/deploys`를 조회한다).

## 8. 아직 사람이 정할 것

- 카테고리(라이프스타일 · 도구 등 중 하나)
- 그래픽 이미지 도안 — 1024×500, 아직 없다
- 스크린샷 최종 선정 — 저장소에 2장, 캡처본 6장 중 나머지는 저장소 밖
- 개인정보처리방침이 확정본인지
- 심사자용 접속 방법을 어떻게 줄지
- 견적서·계약서 업로드 경로(경로 A)의 동의 절차 — 결제 증빙 경로와 달리 동의를 묻는 단계가
  없다. 등급과 최소 수정안은 판정 대기다
