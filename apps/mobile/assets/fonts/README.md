# Pretendard

대표님이 2026-09-15에 올리신 원본 배포판(`public.zip` · `static.zip` · `variable.zip`)에서
꺼낸 파일이다. **여기 있는 것만 쓴다 — 웹에서 받아 오지 않는다.**

| 자리 | 파일 | 쓰는 곳 |
| --- | --- | --- |
| `apps/mobile/assets/fonts/` | `Pretendard-{Regular,SemiBold,Bold}.ttf` | 앱(iOS · Android). `app.json`의 `expo-font` 플러그인이 빌드 때 심는다 |
| `apps/mobile/public/fonts/` | `PretendardVariable.woff2` | 앱을 웹으로 내보낸 것(`+html.tsx`) |
| `apps/web/public/assets/fonts/` | `PretendardVariable.woff2` | 마케팅 웹(`apps/web/src/fonts.ts`) |

## 굵기를 넷만 싣는 이유

`spec/tokens.json` `typography.$weights`는 「700 · 400 두 가지만」이라고 적지만, 화면 코드를
실제로 세면 **400이 1곳 · 600이 14곳 · 700이 188곳 · 800이 2곳**이다. 600과 800을 빼면
안드로이드가 가장 가까운 굵기로 흉내 내서(합성 볼드) 글자가 뭉개진다. 네 벌을 싣는다.

**웹은 가변 폰트 한 벌로 끝난다** — 45~920 축 하나가 넷을 다 덮고, 정적 네 벌보다 작다.

## 라이선스

Copyright (c) 2021 Kil Hyung-jin, with Reserved Font Name Pretendard.
<https://github.com/orioncactus/pretendard>

SIL Open Font License, Version 1.1. 전문은 <http://scripts.sil.org/OFL>과 위 저장소의
`LICENSE`에 있다. **원본 배포판 zip에 라이선스 전문 파일이 들어 있지 않아 옮겨 적지 못했다** —
지어내지 않고 이렇게 남긴다. 앱을 스토어에 올리기 전에 전문을 받아 이 폴더에 넣는다.

## 2026-09-17 — 줄였다

대표님 지시 「용량은 미리 축소한다」. `scripts/subset-fonts.py`가 제자리에서 줄인다.

```
전   10,728,696 bytes
후    8,796,232 bytes   (18% 감소)
```

**한글은 한 자도 빼지 않았다.** 네이티브는 필요할 때 더 받는 길이 없어서, 없는 글자는
그냥 안 그려진다. 덜어낸 것은 안 쓰는 문자 계열뿐이다 — 키릴 · 그리스 · 가나 · IPA.

**웹은 다른 방법으로 줄였다**(`packages/domain/src/web-font.ts`). 그쪽은 `unicode-range`로
필요한 쪽만 받을 수 있어서 흔한 글자 2,350자를 따로 떼어 493KB로 만들었다.

### ExtraBold는 뺐다 (2026-09-17 대표 지시 「줄이고」)

```
10,728,696  →  8,796,232  →  6,607,020 bytes   (전체 38% 감소)
   원본         계열 정리       ExtraBold 제거
```

굵기 800을 쓰는 자리는 **`packages/ui/src/npay-logo.tsx` 두 줄뿐**이었다. 두 줄 때문에
2.19MB를 앱에 넣고 다녔다.

**코드의 `fontWeight: '800'`은 그대로 뒀다.** 규격이 800이고(핸드오프 v3.22) 웹은
가변 폰트(45~920)라 **실제로 800을 그린다** — 코드를 700으로 적으면 웹까지 내려간다.
네이티브만 기기가 700으로 떨어뜨린다.

굵기별 쓰임 (`apps/mobile/src` · `packages/ui/src`에서 센 것):

```
700  257곳      파일 있음
600   32곳      파일 있음
400   32곳      파일 있음
500   11곳      파일 없음 — 기기가 가장 가까운 것으로 떨어뜨린다
800    2곳      파일 없음 — 웹은 800, 네이티브는 700
```

네이티브에서도 정확히 800이어야 하면 TTF를 되돌린다. 그때는 2.19MB를 치르는 것이다.
