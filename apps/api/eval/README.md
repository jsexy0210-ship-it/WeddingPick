# 추출 정확도 측정

AI가 견적서를 얼마나 제대로 읽는지 잰다. **모델을 실제로 호출하므로 비용이 든다.**

```bash
ANTHROPIC_API_KEY=... npm run analysis:eval --workspace @weddingpick/api

# 직접 모은 견적서로
ANTHROPIC_API_KEY=... npm run analysis:eval --workspace @weddingpick/api -- ~/견적서들
```

## 케이스 만들기

문서 파일(`.png` `.jpg` `.webp` `.pdf`) 하나가 케이스 하나다. 같은 이름의
`*.expected.json`이 있으면 채점하고, 없으면 추출 결과만 보여준다 —
**실제 견적서를 처음 넣어볼 때는 기대값 없이 그냥 넣으면 된다.**

```json
{
  "documentKind": "quote",
  "vendorName": "더채플앳청담",
  "totalAmount": 23700000,
  "contractDate": null,
  "termCategories": ["refund", "penalty"],
  "lineItemKeywords": { "included": ["대관", "식대"], "additional_candidate": ["보증인원"] },
  "personalInfoKinds": ["name", "phone"]
}
```

적지 않은 항목은 채점하지 않는다. 이름은 공백·괄호를 지우고 비교하므로
"더 채플 앳 청담"과 "더채플앳청담"은 같은 것으로 본다.

기대값과 무관하게 **개인정보 값이 결과에 새어 나왔는지는 항상 검사한다** —
연락처나 주민번호 형태가 구조화 결과에 있으면 실패로 잡는다.

## 지금 들어 있는 케이스

| 파일 | 무엇을 보는가 |
|---|---|
| `hall-quote` | 웨딩홀 예식 견적서. 표 형식, 할인 음수, 보증인원 초과·생화 업그레이드 같은 추가금 문구, 3단계 위약금 조항. **상담일은 있고 계약일은 없다** — 상담일을 계약일로 옮겨 적으면 오답 |
| `sdm-pre-contract` | 스드메 가계약서. 만원 단위("30만원~80만원")와 원 단위 표기가 섞여 있고, 헬퍼비처럼 현장 결제되는 항목이 들어 있다 |

두 문서는 **실제 업체에서 받은 것이 아니라 형식을 본떠 만든 것**이다. 표가 반듯하고
글씨가 선명하므로, 손으로 찍은 사진·감열지 인쇄·기울어진 촬영본에서 어떻게 되는지는
알려주지 않는다. 실제로 받은 견적서를 몇 장 넣어보는 것이 이 하네스의 목적이다.
