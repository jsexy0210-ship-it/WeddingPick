# WeddingPick (웨딩픽) 디자인 시스템

한국 결혼 준비에서 받은 **견적서·가계약서·계약서를 찍어 올리면 실제 계약 데이터와
견줘주는** 앱의 UI 부품들입니다. 화면에 쓰는 말과 색이 곧 제품 약속이라, 아래
규약은 취향이 아니라 지켜야 하는 선입니다.

## 어디서 도는가

React Native 컴포넌트입니다. 웹에서는 react-native-web으로 그려집니다. 그래서
`div`·`span`·`button` 같은 DOM 태그를 직접 쓰지 말고, 여기 있는 컴포넌트로
조합하세요. 레이아웃은 `ThemedView`, 글자는 `ThemedText`가 답니다.

## 색과 글꼴은 Montage에서 온다

색·간격은 Wanted의 **Montage 디자인 시스템**(`@montage-ui/theme`)에서 그때그때
읽습니다. 글꼴은 **Pretendard**이며 번들에 실려 있습니다. 임의의 hex 값이나
숫자 여백을 새로 만들지 말고, 내보낸 `Colors`·`Spacing`·`Radius`를 쓰세요.

라이트/다크 두 모드가 모두 살아 있습니다. 색을 직접 고르지 말고 `ThemedText`의
`themeColor`, `ThemedView`의 `type`으로 **역할**을 고르면 모드는 알아서 맞습니다.

## ThemedView에는 투명 모드가 없다

`ThemedView`는 언제나 배경색을 칠합니다(`type`을 안 주면 `background` — 밝은 면).
그래서 **색이 있는 면 안에서 레이아웃 래퍼로 쓸 때는 바깥 면과 같은 `type`을 넘겨야**
합니다. 안 그러면 카드 위에 흰 판이 덮입니다.

```tsx
<ThemedView type="backgroundElement" style={{ borderRadius: Radius.large, padding: Spacing.three }}>
  {/* 안쪽 래퍼도 같은 면을 물려받는다 */}
  <ThemedView type="backgroundElement" style={{ alignItems: 'flex-start' }}>
    <VerificationBadge level="L2" />
  </ThemedView>
</ThemedView>
```

## 화면에 코드값을 쓰지 않는다

`L0`~`L4`, enum 값, mimeType 같은 내부 표기가 사용자 눈에 닿으면 안 됩니다.
`VerificationBadge`에 `level="L2"`를 넘기면 화면에는 «계약인증»이라고 나옵니다 —
번역은 컴포넌트가 합니다. 직접 라벨을 지어내지 마세요.

## "AI"라고 쓰지 않는다

분석 기능을 가리킬 때 «AI»라는 말을 쓰지 않습니다. «분석 결과», «분석 안내»,
«정리해드립니다»처럼 무엇을 해주는지로 씁니다.

## 확인 단계 다섯의 색은 고정이다

미인증·견적인증·계약인증·이용인증·최종금액 인증은 각각 색이 정해져 있고 UI 전체에서
같습니다. 신뢰도를 나타내는 표시라 화면마다 달라지면 안 됩니다. 색을 덧칠하지 말고
`VerificationBadge`를 그대로 쓰세요.

## 금액을 나란히 놓을 때는 경고가 함께 간다

여러 업체의 금액을 비교하는 화면에는 **금액만으로 비교할 수 없다**는 안내가 반드시
함께 붙습니다(웨딩홀은 식사·주차·교통·시설이, 스드메는 업체별 품질과 추가비용이
함께 걸려 있습니다). 표만 덩그러니 두지 마세요.

## 출처를 적는다

업체 정보나 통계를 보여줄 때는 어디서 온 값인지와 확인 시점을 함께 적습니다.
근거 없는 숫자를 화면에 올리지 않습니다.
