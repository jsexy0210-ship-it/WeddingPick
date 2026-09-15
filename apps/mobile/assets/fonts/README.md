# Pretendard

대표님이 2026-09-15에 올리신 원본 배포판(`public.zip` · `static.zip` · `variable.zip`)에서
꺼낸 파일이다. **여기 있는 것만 쓴다 — 웹에서 받아 오지 않는다.**

| 자리 | 파일 | 쓰는 곳 |
| --- | --- | --- |
| `apps/mobile/assets/fonts/` | `Pretendard-{Regular,SemiBold,Bold,ExtraBold}.ttf` | 앱(iOS · Android). `app.json`의 `expo-font` 플러그인이 빌드 때 심는다 |
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
