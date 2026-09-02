/**
 * 서비스 오픈 전에 확정해야 하는 문서와 그 상태.
 *
 * 앱 정책 화면과 웹 랜딩이 같은 것을 본다. 한쪽에서만 "게시됨"으로 바뀌면 어느 쪽이
 * 맞는지 아무도 모르게 된다.
 *
 * 법률검토 문서는 "AI 안내"라 부르지만 사용자에게는 "분석 안내"로 쓴다 — 알아야 할 것은
 * 결과의 성격이지 무엇으로 읽었는지가 아니다.
 */

export type PolicyStatus = '자문 대기' | '작성 필요' | '초안 게시';

export type PolicyDocument = {
  id: string;
  title: string;
  status: PolicyStatus;
  note: string;
  /** 확정본이 게시된 곳. 없으면 아직 게시하지 않았다는 뜻이다. */
  url?: string;
};

export const POLICY_DOCUMENTS: readonly PolicyDocument[] = [
  {
    id: 'terms',
    title: '이용약관',
    status: '초안 게시',
    note: '법률 자문을 마친 초안이에요. 확정 전 내용으로 언제든 바뀔 수 있어요.',
    url: 'https://weddingpick.kr/terms',
  },
  {
    id: 'privacy',
    title: '개인정보처리방침',
    status: '초안 게시',
    note: '법률 자문을 마친 초안이에요. 확정 전 내용으로 언제든 바뀔 수 있어요.',
    url: 'https://weddingpick.kr/privacy',
  },
  {
    id: 'analysis-notice',
    title: '분석 안내',
    status: '초안 게시',
    note: '견적서를 어떻게 읽고 무엇을 보장하지 않는지 안내해요. 법률 검토 후 확정해요.',
    // 랜딩 안에 있다. 앱에서는 안내 화면이 같은 글을 보여준다.
    url: '#analysis-notice',
  },
];

/** 확정본이 게시된 문서만. 앱스토어 심사가 요구하는 링크는 여기서 나온다. */
export function publishedPolicies(): PolicyDocument[] {
  return POLICY_DOCUMENTS.filter((policy) => policy.url !== undefined);
}
