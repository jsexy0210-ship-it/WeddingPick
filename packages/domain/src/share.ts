/**
 * 공유 문구·링크. WP-SHT-011.
 *
 * `partner-link.ts`의 초대 링크와 같은 모양이다 — 앱 스킴 링크를 먼저 두면
 * 앱이 깔린 사람은 누른 자리로 바로 열리고, 링크가 안 열리는 사람에게는 문구
 * 자체가 무엇을 보고 있었는지 말해준다. 공유는 화면(`Share.share`)이 맡고,
 * 이 파일은 그 문구만 만든다 — 웹에도 같은 문구를 써야 할 날이 오면 이 함수를
 * 그대로 가져다 쓴다.
 */

const SHARE_LINK_SCHEME = 'weddingpick';

export function vendorShareLink(vendorId: string): string {
  return `${SHARE_LINK_SCHEME}://search/${encodeURIComponent(vendorId)}`;
}

export function vendorShareMessage(input: {
  id: string;
  name: string;
  categoryLabel: string;
  region: string;
}): string {
  return [
    `${input.name} · ${input.categoryLabel} · ${input.region}`,
    vendorShareLink(input.id),
    '웨딩픽에서 확인된 정보를 볼 수 있어요.',
  ].join('\n');
}

export function compareShareLink(vendorIds: readonly string[]): string {
  const query = vendorIds.map((id) => encodeURIComponent(id)).join(',');

  return `${SHARE_LINK_SCHEME}://search/compare?ids=${query}`;
}

export function compareShareMessage(vendorNames: readonly string[], vendorIds: readonly string[]): string {
  return [
    `${vendorNames.join(' · ')} 비교`,
    compareShareLink(vendorIds),
    '웨딩픽에서 견준 내용을 볼 수 있어요.',
  ].join('\n');
}
