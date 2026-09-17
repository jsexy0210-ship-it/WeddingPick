# 웨딩픽 · 스타일 이미지 생성 프롬프트

온보딩 5/5에 쓸 **4장**의 생성 프롬프트입니다. GPT-4o · DALL-E · Midjourney 어디든 그대로 붙여 쓸 수 있습니다.

## 먼저 읽을 것

**세로 5:6으로 뽑습니다.** 카드가 166 x 200이라 정사각을 주면 위아래가 잘립니다. 1000 x 1200 이상.

**넷 다 예식 공간 컷입니다.** 피사체 종류를 섞지 마세요. 스타일이 아니라 업종을 고르게 됩니다.

**사람을 넣지 않습니다.** 시선이 얼굴로 가면 공간이 안 읽힙니다.

**넷을 나란히 놓고 확인하세요.** 도시적인과 화려한이 겹치기 쉽습니다. 도시적인은 밝고 비어 있게, 화려한은 어둡고 채워지게 가야 갈립니다.

## Midjourney 파라미터

```
--ar 5:6 --style raw --stylize 250 --v 6
```

`--style raw`를 넣지 않으면 과하게 예뻐져서 실사감이 떨어집니다.

## 네거티브 프롬프트

```
no people, no faces, no text overlay, no watermark, no logo, no border, no collage, no cartoon, no illustration, no oversaturated colors, no harsh flash, no fisheye distortion
```

---

**1 · 도시적인**  `style_urban.jpg`

```
urban house wedding venue, floor-to-ceiling glass wall and exposed concrete, black steel window frames, pale grey and white palette, bright and nearly empty room, clean side light, restrained modern space, Korean wedding venue interior, vertical 5:6 composition, no people, editorial architectural photography, no text, no watermark, no logo, shot on 35mm lens, bottom-left area kept visually simple
```

**2 · 자연스러운**  `style_natural.jpg`

```
garden wedding venue outdoors, raw oak chairs on green lawn, linen runners and eucalyptus, warm beige and sage palette, dappled sunlight through tall trees, relaxed natural setting, Korean wedding venue interior, vertical 5:6 composition, no people, editorial architectural photography, no text, no watermark, no logo, shot on 35mm lens, bottom-left area kept visually simple
```

**3 · 로맨틱한**  `style_romantic.jpg`

```
small chapel wedding venue, aisle lined with blush peonies and tulle draping, tall candles, ivory and soft pink palette, warm backlight through arched window, tender atmospheric mood, Korean wedding venue interior, vertical 5:6 composition, no people, editorial architectural photography, no text, no watermark, no logo, shot on 35mm lens, bottom-left area kept visually simple
```

**4 · 화려한**  `style_glamorous.jpg`

```
hotel ballroom wedding venue, marble floor and gold candelabra, crystal chandeliers overhead, deep jewel-tone palette, dark room with dramatic warm pools of light, opulent fully dressed tables, Korean wedding venue interior, vertical 5:6 composition, no people, editorial architectural photography, no text, no watermark, no logo, shot on 35mm lens, bottom-left area kept visually simple
```

---

## 한 번에 뽑을 때

```
아래 4개 웨딩 공간을 각각 세로 5:6 이미지로 만들어줘.
사람은 넣지 말고 공간과 소재, 빛만 보이게 해줘.
글자나 워터마크는 넣지 마.
좌하단은 라벨이 얹힐 자리라 단순하게 둬.
네 장의 스타일이 서로 확실히 구분되게 해줘.
특히 1번은 밝고 비어 있게, 4번은 어둡고 채워지게.

1. 도시적인 — urban house wedding venue, floor-to-ceiling glass wall and exposed concrete, black steel window frames, pale grey and white palette, bright and nearly empty room, clean side light, restrained modern space
2. 자연스러운 — garden wedding venue outdoors, raw oak chairs on green lawn, linen runners and eucalyptus, warm beige and sage palette, dappled sunlight through tall trees, relaxed natural setting
3. 로맨틱한 — small chapel wedding venue, aisle lined with blush peonies and tulle draping, tall candles, ivory and soft pink palette, warm backlight through arched window, tender atmospheric mood
4. 화려한 — hotel ballroom wedding venue, marble floor and gold candelabra, crystal chandeliers overhead, deep jewel-tone palette, dark room with dramatic warm pools of light, opulent fully dressed tables
```

## 파일명

```
uploads/style_urban.jpg
uploads/style_natural.jpg
uploads/style_romantic.jpg
uploads/style_glamorous.jpg
```
