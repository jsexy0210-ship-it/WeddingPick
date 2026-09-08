# 웨딩픽 · 취향 이미지 생성 프롬프트

온보딩 5/5 취향 카드에 쓸 이미지 **63장**의 생성 프롬프트입니다. GPT-4o · DALL-E · Midjourney 어디든 그대로 붙여 쓸 수 있습니다.

## 먼저 읽을 것

**정사각 1:1로 뽑습니다.** 카드가 165 × 186으로 표시되지만 crop이 중앙 cover라 정사각이 가장 안전합니다. 800 × 800 이상.

**얼굴이 크게 나오면 안 됩니다.** 분위기를 보는 카드라 인물보다 톤 · 공간 · 질감이 읽혀야 합니다. 모든 프롬프트에 얼굴 회피 조건을 넣었습니다.

**좌하단에 라벨이 얹힙니다.** 그 자리가 복잡하면 글자가 묻힙니다. 여러 장 뽑았으면 좌하단이 단순한 것을 고르세요.

## 공통 꼬리말

각 프롬프트 끝에 이미 붙어 있습니다. 도구를 바꿀 때는 이 부분만 조정하세요.

```
Korean wedding photography, square 1:1 composition, natural soft lighting, editorial magazine quality, no visible faces or faces turned away, no text, no watermark, no logo, muted elegant color palette, shot on 50mm lens
```

## 네거티브 프롬프트

Midjourney · Stable Diffusion에서는 별도로 넣습니다.

```
no large close-up faces, no text overlay, no watermark, no logo, no border, no collage, no cartoon, no illustration, no oversaturated colors, no harsh flash, no cluttered background
```

## Midjourney 파라미터

```
--ar 1:1 --style raw --stylize 250 --v 6
```

`--style raw`를 넣지 않으면 과하게 예뻐져서 실사감이 떨어집니다.

## 우선순위

```
1순위   웨딩홀 6장       01~06
2순위   스튜디오 3장     07~09
3순위   드레스 6장       10~15
그 외    나머지 48장
```

**01~09 아홉 장만 있으면 대부분의 사용자가 정상 화면을 봅니다.** 웨딩홀을 아직 안 정한 사용자가 가장 많고, 그 다음이 스튜디오입니다.

## 파일명

받은 이미지를 `uploads/`에 넣고 아래 이름으로 저장하시면 코드에서 바로 참조합니다.

```
uploads/taste_hall_hotel.jpg
uploads/taste_hall_chapel.jpg
...
```

보유한 스튜디오 3장은 기존 파일명을 유지합니다.

```
uploads/깔끔한 화이트.jpg
uploads/모던미니멀.jpg
uploads/따뜻한 필름.jpg
```

---

## 웨딩홀 · 6장

**01 · 호텔**  `taste_hall_hotel.jpg`

```
luxury hotel wedding ballroom interior, crystal chandelier, round tables with white linen, warm golden uplighting, high ceiling, empty before guests arrive, Korean wedding photography, square 1:1 composition, natural soft lighting, editorial magazine quality, no visible faces or faces turned away, no text, no watermark, no logo, muted elegant color palette, shot on 50mm lens
```

**02 · 채플**  `taste_hall_chapel.jpg`

```
wedding chapel interior, long aisle with wooden pews, tall stained glass windows, soft daylight beams, white floral aisle decor, symmetrical view toward altar, Korean wedding photography, square 1:1 composition, natural soft lighting, editorial magazine quality, no visible faces or faces turned away, no text, no watermark, no logo, muted elegant color palette, shot on 50mm lens
```

**03 · 야외**  `taste_hall_outdoor.jpg`

```
outdoor garden wedding ceremony setup, white chairs on green lawn, floral arch, tall trees, late afternoon golden sunlight, no people, Korean wedding photography, square 1:1 composition, natural soft lighting, editorial magazine quality, no visible faces or faces turned away, no text, no watermark, no logo, muted elegant color palette, shot on 50mm lens
```

**04 · 하우스웨딩**  `taste_hall_house.jpg`

```
small house wedding venue, brick wall and large windows, wooden floor, intimate seating for 40 guests, greenery and candles, cozy daylight, Korean wedding photography, square 1:1 composition, natural soft lighting, editorial magazine quality, no visible faces or faces turned away, no text, no watermark, no logo, muted elegant color palette, shot on 50mm lens
```

**05 · 밝은 홀**  `taste_hall_bright.jpg`

```
bright modern wedding hall, floor-to-ceiling windows, white and ivory interior, natural daylight flooding the room, minimal white floral, airy feeling, Korean wedding photography, square 1:1 composition, natural soft lighting, editorial magazine quality, no visible faces or faces turned away, no text, no watermark, no logo, muted elegant color palette, shot on 50mm lens
```

**06 · 어두운 홀**  `taste_hall_dark.jpg`

```
dark moody wedding hall, deep navy and charcoal interior, dramatic spotlighting on the aisle, candlelit tables, elegant evening atmosphere, Korean wedding photography, square 1:1 composition, natural soft lighting, editorial magazine quality, no visible faces or faces turned away, no text, no watermark, no logo, muted elegant color palette, shot on 50mm lens
```

---

## 스튜디오 · 3장

**07 · 야외 자연광**  `taste_studio_outdoor.jpg`

```
wedding couple walking in a sunlit park, backlit natural light, seen from behind, long white dress trailing, green trees, airy summer feeling, Korean wedding photography, square 1:1 composition, natural soft lighting, editorial magazine quality, no visible faces or faces turned away, no text, no watermark, no logo, muted elegant color palette, shot on 50mm lens
```

**08 · 클래식**  `taste_studio_classic.jpg`

```
classic studio wedding portrait, deep burgundy velvet backdrop, formal pose seen from behind or side, timeless elegant lighting, rich shadows, Korean wedding photography, square 1:1 composition, natural soft lighting, editorial magazine quality, no visible faces or faces turned away, no text, no watermark, no logo, muted elegant color palette, shot on 50mm lens
```

**09 · 화보 느낌**  `taste_studio_editorial.jpg`

```
high fashion editorial wedding shoot, dramatic side lighting, bold graphic composition, architectural concrete studio, avant-garde dress silhouette, Korean wedding photography, square 1:1 composition, natural soft lighting, editorial magazine quality, no visible faces or faces turned away, no text, no watermark, no logo, muted elegant color palette, shot on 50mm lens
```

---

## 드레스 · 6장

**10 · 실크**  `taste_dress_silk.jpg`

```
silk satin wedding dress on a mannequin, smooth fluid drape, soft sheen, ivory tone, plain studio background, close on fabric, Korean wedding photography, square 1:1 composition, natural soft lighting, editorial magazine quality, no visible faces or faces turned away, no text, no watermark, no logo, muted elegant color palette, shot on 50mm lens
```

**11 · 비즈**  `taste_dress_beads.jpg`

```
beaded wedding dress detail, hand-sewn pearl and crystal beading, sparkling texture, soft focus background, macro fabric shot, Korean wedding photography, square 1:1 composition, natural soft lighting, editorial magazine quality, no visible faces or faces turned away, no text, no watermark, no logo, muted elegant color palette, shot on 50mm lens
```

**12 · 레이스**  `taste_dress_lace.jpg`

```
delicate lace wedding dress detail, floral chantilly lace over ivory silk, backlit to show pattern, romantic soft light, Korean wedding photography, square 1:1 composition, natural soft lighting, editorial magazine quality, no visible faces or faces turned away, no text, no watermark, no logo, muted elegant color palette, shot on 50mm lens
```

**13 · 미니멀**  `taste_dress_minimal.jpg`

```
minimal modern wedding dress on hanger, clean architectural lines, no embellishment, matte crepe fabric, plain white studio wall, Korean wedding photography, square 1:1 composition, natural soft lighting, editorial magazine quality, no visible faces or faces turned away, no text, no watermark, no logo, muted elegant color palette, shot on 50mm lens
```

**14 · 화려한**  `taste_dress_ornate.jpg`

```
ornate ballgown wedding dress, voluminous tulle skirt, sequin bodice, dramatic full silhouette, luxurious boutique interior, Korean wedding photography, square 1:1 composition, natural soft lighting, editorial magazine quality, no visible faces or faces turned away, no text, no watermark, no logo, muted elegant color palette, shot on 50mm lens
```

**15 · 클래식**  `taste_dress_classic.jpg`

```
classic A-line wedding dress with long veil, timeless silhouette, soft ivory, elegant boutique with vintage mirror, Korean wedding photography, square 1:1 composition, natural soft lighting, editorial magazine quality, no visible faces or faces turned away, no text, no watermark, no logo, muted elegant color palette, shot on 50mm lens
```

---

## 메이크업 · 6장

**16 · 내추럴**  `taste_makeup_natural.jpg`

```
natural bridal makeup close-up, bare skin finish, soft nude lips, minimal eye makeup, side profile, soft window light, Korean wedding photography, square 1:1 composition, natural soft lighting, editorial magazine quality, no visible faces or faces turned away, no text, no watermark, no logo, muted elegant color palette, shot on 50mm lens
```

**17 · 청순**  `taste_makeup_fresh.jpg`

```
fresh innocent bridal makeup, dewy skin, light pink cheeks and lips, clean brows, gentle daylight, three-quarter view from behind, Korean wedding photography, square 1:1 composition, natural soft lighting, editorial magazine quality, no visible faces or faces turned away, no text, no watermark, no logo, muted elegant color palette, shot on 50mm lens
```

**18 · 또렷한**  `taste_makeup_defined.jpg`

```
defined bridal makeup, sharp eyeliner and lash detail, bold contoured features, studio beauty lighting, dramatic side angle, Korean wedding photography, square 1:1 composition, natural soft lighting, editorial magazine quality, no visible faces or faces turned away, no text, no watermark, no logo, muted elegant color palette, shot on 50mm lens
```

**19 · 화사한**  `taste_makeup_radiant.jpg`

```
radiant bridal makeup, coral blush and glossy lips, bright cheerful tone, backlit soft glow, hair swept aside, Korean wedding photography, square 1:1 composition, natural soft lighting, editorial magazine quality, no visible faces or faces turned away, no text, no watermark, no logo, muted elegant color palette, shot on 50mm lens
```

**20 · 음영**  `taste_makeup_contour.jpg`

```
contoured bridal makeup, deep sculpted eye shadow, warm brown tones, dimensional cheekbones, moody studio lighting, Korean wedding photography, square 1:1 composition, natural soft lighting, editorial magazine quality, no visible faces or faces turned away, no text, no watermark, no logo, muted elegant color palette, shot on 50mm lens
```

**21 · 글로우**  `taste_makeup_glow.jpg`

```
glowing bridal makeup, highlighted cheekbones and dewy finish, luminous skin, golden hour light, shot from behind over shoulder, Korean wedding photography, square 1:1 composition, natural soft lighting, editorial magazine quality, no visible faces or faces turned away, no text, no watermark, no logo, muted elegant color palette, shot on 50mm lens
```

---

## 헤어변형 · 6장

**22 · 업스타일**  `taste_hair_updo.jpg`

```
bridal updo hairstyle from behind, low twisted chignon, pearl hairpins, veil attached at nape, soft studio light, Korean wedding photography, square 1:1 composition, natural soft lighting, editorial magazine quality, no visible faces or faces turned away, no text, no watermark, no logo, muted elegant color palette, shot on 50mm lens
```

**23 · 반업**  `taste_hair_halfup.jpg`

```
half-up bridal hairstyle from behind, loose waves below with twisted crown, small floral pins, natural daylight, Korean wedding photography, square 1:1 composition, natural soft lighting, editorial magazine quality, no visible faces or faces turned away, no text, no watermark, no logo, muted elegant color palette, shot on 50mm lens
```

**24 · 생머리**  `taste_hair_straight.jpg`

```
sleek straight bridal hair from behind, glossy long hair, minimal crystal pin, clean modern look, plain background, Korean wedding photography, square 1:1 composition, natural soft lighting, editorial magazine quality, no visible faces or faces turned away, no text, no watermark, no logo, muted elegant color palette, shot on 50mm lens
```

**25 · 웨이브**  `taste_hair_wave.jpg`

```
soft wavy bridal hair from behind, romantic loose curls, side-swept, backlit golden light, airy texture, Korean wedding photography, square 1:1 composition, natural soft lighting, editorial magazine quality, no visible faces or faces turned away, no text, no watermark, no logo, muted elegant color palette, shot on 50mm lens
```

**26 · 포니테일**  `taste_hair_ponytail.jpg`

```
high bridal ponytail from behind, sleek pulled-back hair, ribbon tie, modern minimal styling, studio grey backdrop, Korean wedding photography, square 1:1 composition, natural soft lighting, editorial magazine quality, no visible faces or faces turned away, no text, no watermark, no logo, muted elegant color palette, shot on 50mm lens
```

**27 · 장식 포인트**  `taste_hair_accessory.jpg`

```
bridal hair with statement accessory, jeweled headpiece or fresh flower crown, viewed from behind, detail focus on ornament, Korean wedding photography, square 1:1 composition, natural soft lighting, editorial magazine quality, no visible faces or faces turned away, no text, no watermark, no logo, muted elegant color palette, shot on 50mm lens
```

---

## 본식스냅 · 6장

**28 · 밝고 깨끗한**  `taste_snap_bright.jpg`

```
bright clean wedding day snapshot, white and airy tone, high key exposure, ceremony aisle moment, crisp clarity, Korean wedding photography, square 1:1 composition, natural soft lighting, editorial magazine quality, no visible faces or faces turned away, no text, no watermark, no logo, muted elegant color palette, shot on 50mm lens
```

**29 · 필름톤**  `taste_snap_film.jpg`

```
film-tone wedding snapshot, Kodak Portra grain, warm faded colors, slightly soft focus, candid moment during ceremony, Korean wedding photography, square 1:1 composition, natural soft lighting, editorial magazine quality, no visible faces or faces turned away, no text, no watermark, no logo, muted elegant color palette, shot on 50mm lens
```

**30 · 다큐멘터리**  `taste_snap_documentary.jpg`

```
documentary wedding photojournalism, black and white candid moment, guests laughing, unposed reportage style, available light, Korean wedding photography, square 1:1 composition, natural soft lighting, editorial magazine quality, no visible faces or faces turned away, no text, no watermark, no logo, muted elegant color palette, shot on 50mm lens
```

**31 · 감성적인**  `taste_snap_emotional.jpg`

```
emotional wedding moment, tearful embrace seen from a distance, backlit silhouette, shallow depth of field, tender atmosphere, Korean wedding photography, square 1:1 composition, natural soft lighting, editorial magazine quality, no visible faces or faces turned away, no text, no watermark, no logo, muted elegant color palette, shot on 50mm lens
```

**32 · 클래식**  `taste_snap_classic.jpg`

```
classic formal wedding group portrait composition, symmetrical arrangement, traditional posing, even lighting, timeless framing, Korean wedding photography, square 1:1 composition, natural soft lighting, editorial magazine quality, no visible faces or faces turned away, no text, no watermark, no logo, muted elegant color palette, shot on 50mm lens
```

**33 · 자연스러운**  `taste_snap_candid.jpg`

```
natural candid wedding moment, couple walking away hand in hand, unposed, motion blur, warm afternoon light, Korean wedding photography, square 1:1 composition, natural soft lighting, editorial magazine quality, no visible faces or faces turned away, no text, no watermark, no logo, muted elegant color palette, shot on 50mm lens
```

---

## 부케 · 6장

**34 · 화이트**  `taste_bouquet_white.jpg`

```
all-white bridal bouquet, white roses ranunculus and lily of the valley, held against ivory dress, soft natural light, Korean wedding photography, square 1:1 composition, natural soft lighting, editorial magazine quality, no visible faces or faces turned away, no text, no watermark, no logo, muted elegant color palette, shot on 50mm lens
```

**35 · 파스텔**  `taste_bouquet_pastel.jpg`

```
pastel bridal bouquet, blush pink peach and cream blooms, soft romantic palette, held low, gentle daylight, Korean wedding photography, square 1:1 composition, natural soft lighting, editorial magazine quality, no visible faces or faces turned away, no text, no watermark, no logo, muted elegant color palette, shot on 50mm lens
```

**36 · 생화 내추럴**  `taste_bouquet_natural.jpg`

```
natural garden-style bridal bouquet, loose asymmetric arrangement with trailing greenery, wildflower feeling, outdoor light, Korean wedding photography, square 1:1 composition, natural soft lighting, editorial magazine quality, no visible faces or faces turned away, no text, no watermark, no logo, muted elegant color palette, shot on 50mm lens
```

**37 · 드라이**  `taste_bouquet_dried.jpg`

```
dried flower bridal bouquet, pampas grass wheat and preserved eucalyptus, muted beige tones, textured neutral palette, Korean wedding photography, square 1:1 composition, natural soft lighting, editorial magazine quality, no visible faces or faces turned away, no text, no watermark, no logo, muted elegant color palette, shot on 50mm lens
```

**38 · 볼드 컬러**  `taste_bouquet_bold.jpg`

```
bold colorful bridal bouquet, deep red burgundy and orange blooms, dramatic saturated palette, dark background contrast, Korean wedding photography, square 1:1 composition, natural soft lighting, editorial magazine quality, no visible faces or faces turned away, no text, no watermark, no logo, muted elegant color palette, shot on 50mm lens
```

**39 · 미니**  `taste_bouquet_mini.jpg`

```
small mini bridal bouquet, compact posy of three roses with ribbon, held in one hand, minimal simple styling, Korean wedding photography, square 1:1 composition, natural soft lighting, editorial magazine quality, no visible faces or faces turned away, no text, no watermark, no logo, muted elegant color palette, shot on 50mm lens
```

---

## 청첩장 · 6장

**40 · 미니멀**  `taste_invite_minimal.jpg`

```
minimal wedding invitation flat lay, single card with clean sans-serif layout, white paper, generous margins, top-down view, Korean wedding photography, square 1:1 composition, natural soft lighting, editorial magazine quality, no visible faces or faces turned away, no text, no watermark, no logo, muted elegant color palette, shot on 50mm lens
```

**41 · 클래식**  `taste_invite_classic.jpg`

```
classic wedding invitation flat lay, letterpress serif type, gold foil border, cream cotton paper, wax seal envelope, Korean wedding photography, square 1:1 composition, natural soft lighting, editorial magazine quality, no visible faces or faces turned away, no text, no watermark, no logo, muted elegant color palette, shot on 50mm lens
```

**42 · 감성**  `taste_invite_emotional.jpg`

```
romantic wedding invitation flat lay, watercolor floral wash, soft muted colors, deckle edge paper, ribbon detail, Korean wedding photography, square 1:1 composition, natural soft lighting, editorial magazine quality, no visible faces or faces turned away, no text, no watermark, no logo, muted elegant color palette, shot on 50mm lens
```

**43 · 일러스트**  `taste_invite_illustration.jpg`

```
illustrated wedding invitation flat lay, hand-drawn line art venue sketch, playful layout, colored paper, Korean wedding photography, square 1:1 composition, natural soft lighting, editorial magazine quality, no visible faces or faces turned away, no text, no watermark, no logo, muted elegant color palette, shot on 50mm lens
```

**44 · 사진형**  `taste_invite_photo.jpg`

```
photo wedding invitation flat lay, couple photograph printed on card, modern grid layout, matte finish, envelope beside, Korean wedding photography, square 1:1 composition, natural soft lighting, editorial magazine quality, no visible faces or faces turned away, no text, no watermark, no logo, muted elegant color palette, shot on 50mm lens
```

**45 · 전통**  `taste_invite_traditional.jpg`

```
traditional Korean wedding invitation flat lay, hanji paper, red and navy accents, vertical hangul typography, silk cord, Korean wedding photography, square 1:1 composition, natural soft lighting, editorial magazine quality, no visible faces or faces turned away, no text, no watermark, no logo, muted elegant color palette, shot on 50mm lens
```

---

## 예물 · 6장

**46 · 심플**  `taste_ring_simple.jpg`

```
simple wedding ring pair macro, plain polished platinum bands, no stones, clean white background, soft reflection, Korean wedding photography, square 1:1 composition, natural soft lighting, editorial magazine quality, no visible faces or faces turned away, no text, no watermark, no logo, muted elegant color palette, shot on 50mm lens
```

**47 · 클래식**  `taste_ring_classic.jpg`

```
classic solitaire diamond engagement ring macro, round brilliant cut, yellow gold band, velvet ring box, Korean wedding photography, square 1:1 composition, natural soft lighting, editorial magazine quality, no visible faces or faces turned away, no text, no watermark, no logo, muted elegant color palette, shot on 50mm lens
```

**48 · 화려한**  `taste_ring_ornate.jpg`

```
ornate diamond wedding ring macro, pave setting with halo, brilliant sparkle, dramatic lighting on dark surface, Korean wedding photography, square 1:1 composition, natural soft lighting, editorial magazine quality, no visible faces or faces turned away, no text, no watermark, no logo, muted elegant color palette, shot on 50mm lens
```

**49 · 모던**  `taste_ring_modern.jpg`

```
modern geometric wedding ring pair macro, angular brushed metal, architectural form, concrete surface, Korean wedding photography, square 1:1 composition, natural soft lighting, editorial magazine quality, no visible faces or faces turned away, no text, no watermark, no logo, muted elegant color palette, shot on 50mm lens
```

**50 · 빈티지**  `taste_ring_vintage.jpg`

```
vintage art deco engagement ring macro, milgrain detail and emerald cut stone, antique gold, aged patina, Korean wedding photography, square 1:1 composition, natural soft lighting, editorial magazine quality, no visible faces or faces turned away, no text, no watermark, no logo, muted elegant color palette, shot on 50mm lens
```

**51 · 유니크**  `taste_ring_unique.jpg`

```
unique unconventional wedding ring macro, asymmetric organic form, mixed metals with raw stone, artistic styling, Korean wedding photography, square 1:1 composition, natural soft lighting, editorial magazine quality, no visible faces or faces turned away, no text, no watermark, no logo, muted elegant color palette, shot on 50mm lens
```

---

## 혼수 · 6장

**52 · 미니멀**  `taste_home_minimal.jpg`

```
minimal newlywed living room, white walls, low sofa, single plant, empty space, natural daylight, Scandinavian restraint, Korean wedding photography, square 1:1 composition, natural soft lighting, editorial magazine quality, no visible faces or faces turned away, no text, no watermark, no logo, muted elegant color palette, shot on 50mm lens
```

**53 · 따뜻한 우드**  `taste_home_wood.jpg`

```
warm wooden newlywed interior, oak furniture and linen textiles, beige tones, soft afternoon light, cozy atmosphere, Korean wedding photography, square 1:1 composition, natural soft lighting, editorial magazine quality, no visible faces or faces turned away, no text, no watermark, no logo, muted elegant color palette, shot on 50mm lens
```

**54 · 모던**  `taste_home_modern.jpg`

```
modern newlywed apartment interior, charcoal and steel accents, sharp lines, designer lighting fixture, city window view, Korean wedding photography, square 1:1 composition, natural soft lighting, editorial magazine quality, no visible faces or faces turned away, no text, no watermark, no logo, muted elegant color palette, shot on 50mm lens
```

**55 · 내추럴**  `taste_home_natural.jpg`

```
natural newlywed home interior, rattan and cotton textures, many plants, earthy neutral palette, bright airy room, Korean wedding photography, square 1:1 composition, natural soft lighting, editorial magazine quality, no visible faces or faces turned away, no text, no watermark, no logo, muted elegant color palette, shot on 50mm lens
```

**56 · 호텔식**  `taste_home_hotel.jpg`

```
hotel-style newlywed bedroom, crisp white bedding, symmetrical bedside lamps, dark headboard, luxury finish, Korean wedding photography, square 1:1 composition, natural soft lighting, editorial magazine quality, no visible faces or faces turned away, no text, no watermark, no logo, muted elegant color palette, shot on 50mm lens
```

**57 · 컬러 포인트**  `taste_home_color.jpg`

```
newlywed interior with bold color accent, mustard or emerald sofa against neutral room, playful confident styling, Korean wedding photography, square 1:1 composition, natural soft lighting, editorial magazine quality, no visible faces or faces turned away, no text, no watermark, no logo, muted elegant color palette, shot on 50mm lens
```

---

## 허니문 · 6장

**58 · 휴양**  `taste_honeymoon_resort.jpg`

```
honeymoon resort scene, overwater villa and turquoise lagoon, two lounge chairs, tropical calm, no people, Korean wedding photography, square 1:1 composition, natural soft lighting, editorial magazine quality, no visible faces or faces turned away, no text, no watermark, no logo, muted elegant color palette, shot on 50mm lens
```

**59 · 관광**  `taste_honeymoon_sightseeing.jpg`

```
honeymoon sightseeing scene, European old town street with cathedral, cobblestone, warm evening light, Korean wedding photography, square 1:1 composition, natural soft lighting, editorial magazine quality, no visible faces or faces turned away, no text, no watermark, no logo, muted elegant color palette, shot on 50mm lens
```

**60 · 자연**  `taste_honeymoon_nature.jpg`

```
honeymoon nature scene, alpine lake with snow peaks, pine forest, crisp clear air, wide landscape, Korean wedding photography, square 1:1 composition, natural soft lighting, editorial magazine quality, no visible faces or faces turned away, no text, no watermark, no logo, muted elegant color palette, shot on 50mm lens
```

**61 · 도시**  `taste_honeymoon_city.jpg`

```
honeymoon city scene, night skyline from a high terrace, glowing windows, two wine glasses on railing, Korean wedding photography, square 1:1 composition, natural soft lighting, editorial magazine quality, no visible faces or faces turned away, no text, no watermark, no logo, muted elegant color palette, shot on 50mm lens
```

**62 · 액티비티**  `taste_honeymoon_activity.jpg`

```
honeymoon activity scene, snorkeling over coral reef or hot air balloon at sunrise, sense of adventure, Korean wedding photography, square 1:1 composition, natural soft lighting, editorial magazine quality, no visible faces or faces turned away, no text, no watermark, no logo, muted elegant color palette, shot on 50mm lens
```

**63 · 럭셔리**  `taste_honeymoon_luxury.jpg`

```
luxury honeymoon scene, private pool suite with marble and teak, champagne on tray, sunset ocean view, Korean wedding photography, square 1:1 composition, natural soft lighting, editorial magazine quality, no visible faces or faces turned away, no text, no watermark, no logo, muted elegant color palette, shot on 50mm lens
```

---

## 한 번에 뽑을 때

GPT에 이렇게 던지면 6장을 한 세션에서 처리합니다.

```
아래 6개 장면을 각각 정사각 1:1 이미지로 만들어줘.
한국 웨딩 사진 톤, 자연광, 잡지 화보 품질.
얼굴이 크게 나오지 않게 하고 글자나 워터마크는 넣지 마.
좌하단은 라벨이 얹힐 자리라 비교적 단순하게 둬.

1. (프롬프트 01)
2. (프롬프트 02)
...
```
