import { AGENCY_CONDITION_LABEL, AGENCY_PRICE_SOURCE_LABEL } from './agency-price';
import { findBannedPhrases, findVaguePhrases } from './copy-rules';
import { DISCLOSURE_LIMIT_LABEL } from './policy-engine';
import { FAQ_ITEMS } from './faq';
import { PRICE_JUDGEMENT_LABEL } from './pricing';
import { REPORT_STATE_LABEL } from './report-state';
import { TERMS } from './terms';
import { TOP3_EMPTY, TOP3_PARTIAL_NOTE, TOP3_REASON_LABEL } from './top3';
import { VENDOR_DETAIL_SECTIONS } from './vendor-detail';
import {
  WITHDRAWAL_HEADLINE,
  WITHDRAWAL_IRREVERSIBLE,
  WITHDRAWAL_SEPARATED_NOTE,
  WITHDRAWAL_SHEET_BODY,
  WITHDRAWAL_TITLE,
} from './withdrawal';

/**
 * 화면에 나가는 말 전체를 한 번에 훑는다.
 *
 * 모듈마다 자기 시험에서 자기 문구를 보고 있지만, **새 모듈이 생기면 그 시험도
 * 새로 써야 한다** — 안 쓰면 아무도 안 본다. 여기 목록에 넣기만 하면 규칙이 걸린다.
 */
const USER_COPY: [string, string][] = [
  ...Object.entries(TERMS),
  ...Object.entries(TOP3_REASON_LABEL),
  ...Object.entries(REPORT_STATE_LABEL),
  ...Object.entries(PRICE_JUDGEMENT_LABEL),
  ...Object.entries(DISCLOSURE_LIMIT_LABEL),
  ...Object.entries(AGENCY_CONDITION_LABEL),
  ...Object.entries(AGENCY_PRICE_SOURCE_LABEL),
  ...VENDOR_DETAIL_SECTIONS.map((section): [string, string] => [section.key, section.label]),
  ...FAQ_ITEMS.flatMap((item): [string, string][] => [
    [`faq:${item.key}:q`, item.question],
    [`faq:${item.key}:a`, item.answer],
  ]),
  ['top3:empty', TOP3_EMPTY],
  ['top3:partial', TOP3_PARTIAL_NOTE],
  ['withdrawal:headline', WITHDRAWAL_HEADLINE],
  ['withdrawal:title', WITHDRAWAL_TITLE],
  ['withdrawal:irreversible', WITHDRAWAL_IRREVERSIBLE],
  ['withdrawal:separatedNote', WITHDRAWAL_SEPARATED_NOTE],
  ['withdrawal:sheetBody', WITHDRAWAL_SHEET_BODY],
];

describe('사용자에게 나가는 말', () => {
  it.each(USER_COPY)('%s에 금지어가 없다', (_key, text) => {
    // 값매김·`평균가`·`표본` 같은 말. 웨딩픽은 데이터를 보여주고 사용자가 판단한다.
    expect(findBannedPhrases(text).map((v) => v.phrase)).toEqual([]);
  });

  it.each(USER_COPY)('%s에 애매한 말이 없다', (_key, text) => {
    // `거의`·`아마`·`대략`. 상태를 확정/미확정/확인 필요로 적는다.
    expect(findVaguePhrases(text).map((v) => v.phrase)).toEqual([]);
  });

  it.each(USER_COPY)('%s에 AI가 안 나온다', (_key, text) => {
    // 사용자가 알아야 할 것은 결과의 성격이지 무엇으로 읽었는지가 아니다.
    expect(text).not.toMatch(/\bAI\b/);
  });
});
