/**
 * 웨딩 정보 — 홈 아래쪽의 이미지 피드.
 *
 * **서버에 아직 자리가 없다.** 계약에도 API에도 콘텐츠라는 개념이 없다. 그래서
 * 지금은 빈 목록을 돌려주고, 홈은 목록이 비면 그 섹션을 통째로 접는다.
 *
 * 시안에 있는 «투어 전에 정해둘 세 가지» 같은 제목을 하드코딩해 두지 않는 이유는,
 * 그게 시안에서는 자리를 채우는 회색 상자와 같은 역할이지만 앱에서는 **읽을 수
 * 있는 글처럼 보이기** 때문이다. 눌러도 아무것도 없는 카드가 홈에 두 장 있는 것은
 * 섹션이 없는 것보다 나쁘다.
 *
 * 화면은 이 함수만 알고 있어서, 콘텐츠 API가 생기면 여기서 그것을 부르면 된다.
 * 컴포넌트(`WeddingContent`)는 이미 시안대로 다 그려져 있다.
 *
 * 사용자에게 보이는 말은 «웨딩픽 콘텐츠»다 — `AI`라고 적지 않는다.
 */

export type WeddingContentItem = {
  id: string;
  /** 어느 업종 이야기인가. 카드 위 작은 줄. */
  categoryLabel: string;
  title: string;
  imageUri: string | null;
};

/** TODO: 콘텐츠 API가 생기면 여기서 부른다. 그때까지 홈의 이 섹션은 접혀 있다. */
export async function listWeddingContent(): Promise<readonly WeddingContentItem[]> {
  return [];
}
