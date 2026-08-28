import {
  ANALYSIS_DISCLAIMER,
  ANALYSIS_FACTS,
  HALL_CANCELLATION_STANDARD,
  POLICY_DOCUMENTS,
  PRICING_POLICY,
  VERIFICATION_LEVEL_RULES,
  formatAttribution,
  listDataSources,
} from '@weddingpick/domain';

import { escapeHtml, renderLandingPage } from './page';

const html = renderLandingPage('');

describe('랜딩', () => {
  it('바깥 자료의 출처를 빠짐없이 적는다', () => {
    // 공공누리는 유형과 무관하게 출처 표시를 요구한다.
    for (const source of listDataSources()) {
      expect(html).toContain(escapeHtml(formatAttribution(source)));
      expect(html).toContain(escapeHtml(source.usedFor));
    }
  });

  it('확인하지 않은 이용허락범위를 적지 않는다', () => {
    expect(html).not.toContain('공공누리');
  });

  it('기준 위약금을 도메인에서 가져온다', () => {
    // 랜딩에 숫자를 따로 적어두면 기준이 바뀔 때 한쪽만 고쳐진다.
    for (const band of HALL_CANCELLATION_STANDARD) {
      expect(html).toContain(escapeHtml(band.note));
    }
  });

  it('최소 표본 수를 정책에서 가져온다', () => {
    expect(html).toContain(`${PRICING_POLICY.minimumSampleCount}건`);
  });

  it('어느 단계부터 가격 비교에 반영되는지 밝힌다', () => {
    expect(html).toContain(escapeHtml(VERIFICATION_LEVEL_RULES.L2.label));
    expect(html).toContain('가격 비교에 반영');
    expect(html).toContain('반영하지 않음');
  });

  it('법적 효력이 없다는 고지를 싣는다', () => {
    // 서비스정책서 1번. 앱과 웹이 같은 문장을 쓴다.
    expect(html).toContain(escapeHtml(ANALYSIS_DISCLAIMER));
  });

  it('정책의 게시 상태와 링크가 어긋나지 않는다', () => {
    for (const policy of POLICY_DOCUMENTS) {
      if (policy.url) {
        // 링크가 가리키는 곳이 이 문서 안에 실제로 있어야 한다.
        expect(html).toContain(`href="${escapeHtml(policy.url)}"`);

        if (policy.url.startsWith('#')) {
          expect(html).toContain(`id="${policy.url.slice(1)}"`);
        }
      }
    }

    // 확정본이 없는 문서는 없다고 적는다.
    expect(html).toContain('확정본이 없어 아직 게시하지 않았습니다');
  });

  it('분석 안내를 랜딩에서 게시한다', () => {
    // "게시함"이라고 적어놓고 실제로는 없는 상태가 되지 않게.
    for (const fact of ANALYSIS_FACTS) {
      expect(html).toContain(escapeHtml(fact.title));
      expect(html).toContain(escapeHtml(fact.body));
    }
  });

  it('문의처가 없으면 지어내지 않는다', () => {
    // 지어낸 주소를 붙이면 사람들이 받지 않는 곳으로 편지를 보낸다.
    expect(process.env.WEDDINGPICK_CONTACT_EMAIL).toBeUndefined();
    expect(html).toContain('문의처는 아직 정해지지 않았습니다');
  });

  it('본문에 넣는 값을 이스케이프한다', () => {
    expect(escapeHtml('<script>"x"&\'y\'</script>')).toBe(
      '&lt;script&gt;&quot;x&quot;&amp;&#39;y&#39;&lt;/script&gt;'
    );
  });

  it('한국어 문서로 만든다', () => {
    expect(html).toContain('<html lang="ko">');
    expect(html).toContain('<meta charset="utf-8">');
    expect(html).toContain('name="viewport"');
  });
});
