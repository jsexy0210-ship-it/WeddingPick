import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { VENDOR_DETAIL_SECTIONS, readyVendorDetailSections } from '@weddingpick/domain';

const ROOT = join(__dirname, '..', '..', '..', '..');

const SCREEN = 'apps/mobile/src/app/(tabs)/search/[vendorId]/index.tsx';

/**
 * 업체 상세가 정책이 정한 순서대로 그려지는지. 통합정책 §8.
 *
 * 순서를 `vendor-detail.ts`에 적어뒀지만 **그 목록을 읽는 화면이 없다.** 화면은
 * 자기 순서대로 그리고, 목록은 옆에서 맞다고 주장한다. 둘이 어긋나도 아무도
 * 모르고, 실제로 예전에 공식정보가 업체명 바로 아래에 있었다.
 *
 * 화면이 목록을 읽어 순서대로 그리게 만들 수도 있다. 그러면 각 자리가 서로 다른
 * 모양이라 화면이 거대한 분기 하나가 된다. 그리는 것은 화면에 두고, **순서가
 * 맞는지만** 여기서 지킨다.
 */

/**
 * 각 자리를 화면에서 알아보는 표시.
 *
 * 화면에 나가는 말이 아니라 **소스에 있는 문자열**이다. 문구는 바뀌어도 자리는
 * 남으므로, 자리를 가리키는 가장 짧은 조각을 고른다. 첫 등장 위치로 재므로 머리
 * 주석이나 헬퍼에도 나오는 말(«공식정보» 낱말 · `{vendor.name}`)은 쓰지 않고, 그
 * 자리를 실제로 그리는 줄에만 있는 조각을 고른다.
 */
const ANCHORS: Record<string, string> = {
  name: 'styles.navTitle',
  key_conditions: 'VENDOR_CATEGORY_LABEL[vendor.category]',
  verified_data: 'type="t4">{TERMS.verifiedData}',
  pick: 'styles.actionRow',
  experience: 'type="t4">{TERMS.experience}',
  reviews: 'type="t4">{TERMS.review}',
  official_source: 'type="t4">공식정보',
  report_error: '{REPORT_ERROR}',
};

/**
 * 후기 화면에 있는 자리.
 *
 * `rebuttals`는 후기와 붙어 있어야 무엇에 대한 반론인지 알 수 있다(정책 목록의
 * `note`). 상세에서 찾으면 없다 — 없는 것이 맞다.
 */
const ON_ANOTHER_SCREEN = ['rebuttals'];

describe('업체 상세 정보 순서', () => {
  const source = readFileSync(join(ROOT, SCREEN), 'utf8');

  it('그릴 수 있는 자리마다 화면에 자리가 있다', () => {
    const missing = readyVendorDetailSections()
      .filter((key) => !ON_ANOTHER_SCREEN.includes(key))
      .filter((key) => {
        const anchor = ANCHORS[key];

        return anchor === undefined || !source.includes(anchor);
      });

    expect(missing).toEqual([]);
  });

  it('정책이 정한 순서대로 그린다', () => {
    const positions = readyVendorDetailSections()
      .filter((key) => !ON_ANOTHER_SCREEN.includes(key))
      .map((key) => ({ key, at: source.indexOf(ANCHORS[key]!) }));

    const sorted = [...positions].sort((a, b) => a.at - b.at);

    expect(sorted.map((one) => one.key)).toEqual(positions.map((one) => one.key));
  });

  it('아직 못 그리는 자리는 화면에 빈 칸으로 남지 않는다', () => {
    /*
     * 자료가 없는 자리를 회색 상자로 뚫어두지 않는다. 목록에서 지우지도 않는다 —
     * 지우면 자료가 생기는 날 어디에 넣을지를 다시 정해야 한다.
     */
    for (const section of VENDOR_DETAIL_SECTIONS) {
      if (section.ready) continue;

      expect(section.note).toBeTruthy();

      /* 못 그리는 자리에는 표시를 붙이지 않았다. 붙어 있다면 화면에 그렸다는 뜻이다. */
      expect(ANCHORS[section.key]).toBeUndefined();
    }
  });

  it('표시를 붙일 자리가 목록과 어긋나지 않는다', () => {
    /* 정책 목록에서 사라진 자리를 여기만 계속 찾고 있으면 이 시험이 거짓으로 통과한다. */
    const known = VENDOR_DETAIL_SECTIONS.map((section) => section.key as string);

    expect(Object.keys(ANCHORS).filter((key) => !known.includes(key))).toEqual([]);
    expect(ON_ANOTHER_SCREEN.filter((key) => !known.includes(key))).toEqual([]);
  });
});
