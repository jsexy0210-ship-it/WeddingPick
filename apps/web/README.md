# @weddingpick/web

웹 랜딩. 정적 HTML 한 장을 만든다.

```bash
npm run build --workspace @weddingpick/web   # → apps/web/dist/index.html
```

프레임워크도 런타임 자바스크립트도 없다. 소개 한 장에 필요한 것은 글과 링크뿐이고,
자바스크립트를 켜지 않아도 읽을 수 있어야 한다. CSS는 한 파일에 담아 인라인으로 넣는다.

## 글은 어디서 오나

바뀔 수 있는 것 — 숫자, 기준, 출처, 게시 상태, 안내 문구 — 은 이 워크스페이스에 적지 않고
`@weddingpick/domain`에서 가져온다. 랜딩에 따로 적어두면 기준이 바뀔 때 한쪽만 고쳐지고,
그때 어느 쪽이 우리가 지키는 약속인지 알 수 없게 된다.

| 랜딩의 내용 | 출처 |
|---|---|
| 분석 안내, 결과 고지 문구 | `analysis-notice.ts` — 앱도 같은 것을 쓴다 |
| 확인 단계와 가격 비교 반영 여부 | `verification.ts` |
| 최소 표본 수 | `policy.ts` |
| 예식업 취소 위약금 기준 | `consumer-standards.ts` |
| 자료 출처와 확인일 | `data-sources.ts` |
| 약관·정책의 게시 상태 | `policies.ts` — 앱 정책 화면도 같은 것을 쓴다 |

랜딩 자체의 소개 문구만 [`src/content.ts`](src/content.ts)에 있다.

`src/page.test.ts`가 이 연결을 지킨다 — 도메인 값이 실제로 실렸는지, 게시 상태와 링크가
어긋나지 않는지, 확인하지 않은 이용허락범위를 적지 않았는지.

## 설정

| 환경변수 | 없으면 |
|---|---|
| `WEDDINGPICK_CONTACT_EMAIL` | 문의처를 "아직 정해지지 않았습니다"로 적는다. 지어낸 주소를 붙이면 사람들이 받지 않는 곳으로 편지를 보낸다 |
