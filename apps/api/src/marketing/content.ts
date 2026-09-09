/**
 * 마케팅 콘텐츠 생성기.
 *
 * 실제 AI API를 호출하지 않는다. 검토된 사실 ID를 선택해 고정 템플릿으로 문안을 구성한다.
 * reviewed:true는 운영자의 원문 확인일 뿐, 자동 사실검증 보증이 아니다.
 * 현재 정규식 검사도 법률 검토나 완전한 개인정보 탐지를 대체하지 않는다.
 */

import type { MarketingChannel, MarketingFormat, MarketingSource } from '@weddingpick/api-contract';

/** 검증된 사실 ID → 표현 문장 매핑 (운영자가 검토한 원문) */
export const VERIFIED_FACTS: Record<string, string> = {
  pick: '웨딩픽은 웨딩업체를 먼저 골라주고 사용자는 비교해서 Pick하는 서비스예요.',
  compare: '제보 금액을 바탕으로 업체를 비교할 수 있어요.',
  together: '배우자와 함께 업체 후보를 보고 함께 결정할 수 있어요.',
  schedule: '결혼 준비 일정과 지출을 한곳에서 관리할 수 있어요.',
  data: '제보 금액을 기반으로 구간과 기준금액을 안내해요.',
  proof: '실 제보만 비교에 반영해요.',
  free: '앱 다운로드와 기본 비교 기능은 무료예요.',
  category: '웨딩홀, 스튜디오, 드레스, 결정사 등 카테고리별로 비교할 수 있어요.',
};

/** 채널별 문안 길이 예산 (본문 최대 글자 수) */
const BODY_BUDGET: Record<MarketingChannel, number> = {
  instagram: 300,
  blog: 1200,
  shortform: 150,
  community: 600,
};

/** 포맷별 제목 템플릿 */
const TITLE_TEMPLATE: Record<MarketingFormat, (facts: string[]) => string> = {
  product:   () => '웨딩픽 — 웨딩업체 비교, 먼저 골라드려요',
  feature:   (facts) => facts.length > 1 ? `웨딩픽 ${facts.length}가지 기능 소개` : '웨딩픽 주요 기능',
  checklist: () => '결혼 준비, 웨딩픽으로 체크리스트 시작하기',
  data:      () => '실 제보로 업체 비교하는 법',
};

/** 포맷별 본문 템플릿 */
function buildBody(
  format: MarketingFormat,
  channel: MarketingChannel,
  factSentences: string[],
): string {
  const budget = BODY_BUDGET[channel];
  const sentences = factSentences.slice(0, format === 'checklist' ? 5 : 3);
  let body = '';

  switch (format) {
    case 'product':
      body = `${sentences.join('\n')}`;
      break;
    case 'feature':
      body = sentences.map((s, i) => `${i + 1}. ${s}`).join('\n');
      break;
    case 'checklist':
      body = sentences.map((s) => `□ ${s}`).join('\n');
      break;
    case 'data':
      body = `웨딩픽 실 제보 안내\n\n${sentences.join('\n')}`;
      break;
  }

  return body.slice(0, budget);
}

/** UTM 링크 생성 */
function buildUtmUrl(channel: MarketingChannel, format: MarketingFormat, jobKey: string): string {
  const base = 'https://weddingpick.app';
  const params = new URLSearchParams({
    utm_source: channel,
    utm_medium: 'owned',
    utm_campaign: `marketing_${format}`,
    utm_content: jobKey,
  });
  return `${base}?${params.toString()}`;
}

/** 금지 표현 패턴 (기본 검사만 — 법률 검토 대체 아님) */
const BANNED_PATTERNS = [
  /최저가\s*보장/,
  /가장\s*저렴/,
  /제휴\s*할인/,
  /가짜\s*후기/,
  /이용\s*후기/,
  /100%\s*보장/,
  /계약서\s*업로드/,
];

/** 개인정보 의심 패턴 */
const PII_PATTERNS = [
  /\d{6}-\d{7}/,
  /\d{3}-\d{4}-\d{4}/,
];

export type GenerateResult =
  | { ok: true; title: string; body: string; utmUrl: string; planningPrompt: string }
  | { ok: false; error: string };

/**
 * 소재로부터 콘텐츠를 생성한다.
 * 실제 AI 호출 없음. 검토된 사실 ID를 선택해 서버가 문장을 구성한다.
 */
export function generateContent(
  source: MarketingSource,
  channel: MarketingChannel,
  format: MarketingFormat,
  jobKey: string,
): GenerateResult {
  // 소재 유효성 검사
  if (!source.active) return { ok: false, error: '비활성 소재입니다.' };
  if (!source.reviewed) return { ok: false, error: '운영자 검토가 완료되지 않은 소재입니다.' };
  if (source.expiresAt && new Date(source.expiresAt) < new Date()) {
    return { ok: false, error: '소재 유효기간이 만료됐습니다.' };
  }

  // 사실 ID 검증
  const unknownIds = source.factIds.filter((id) => !(id in VERIFIED_FACTS));
  if (unknownIds.length > 0) {
    return { ok: false, error: `알 수 없는 사실 ID: ${unknownIds.join(', ')}` };
  }
  if (new Set(source.factIds).size !== source.factIds.length) {
    return { ok: false, error: '중복된 사실 ID가 있습니다.' };
  }

  const factSentences = source.factIds.map((id) => VERIFIED_FACTS[id]!);
  const title = TITLE_TEMPLATE[format](source.factIds);
  const body = buildBody(format, channel, factSentences);

  // 금지 표현 검사
  const fullText = `${title}\n${body}`;
  for (const pattern of BANNED_PATTERNS) {
    if (pattern.test(fullText)) {
      return { ok: false, error: `금지 표현이 포함돼 있습니다: ${pattern.source}` };
    }
  }
  for (const pattern of PII_PATTERNS) {
    if (pattern.test(fullText)) {
      return { ok: false, error: '개인정보로 의심되는 패턴이 포함돼 있습니다.' };
    }
  }

  const utmUrl = buildUtmUrl(channel, format, jobKey);

  // AI 호출용 공통 계획 프롬프트 (현재 실제 호출 없음 — 계약만 준비)
  const planningPrompt = [
    `채널: ${channel}`,
    `포맷: ${format}`,
    `사용 가능한 사실 ID: ${source.factIds.join(', ')}`,
    '',
    '아래 JSON 형식으로만 응답하세요:',
    JSON.stringify({ channel, format, factIds: source.factIds.slice(0, 3) }, null, 2),
    '',
    '주의: AI가 자유롭게 만든 본문은 그대로 사용하지 않습니다.',
    '검토된 사실 ID만 선택하고, 서버가 문장을 구성합니다.',
  ].join('\n');

  return { ok: true, title, body, utmUrl, planningPrompt };
}

/** 소재 유효 여부만 확인 (생성 없이) */
export function validateSource(source: MarketingSource): string | null {
  if (!source.active) return '비활성 소재';
  if (!source.reviewed) return '미검토 소재';
  if (source.expiresAt && new Date(source.expiresAt) < new Date()) return '유효기간 만료';
  const unknownIds = source.factIds.filter((id) => !(id in VERIFIED_FACTS));
  if (unknownIds.length > 0) return `알 수 없는 사실 ID: ${unknownIds.join(', ')}`;
  return null;
}
