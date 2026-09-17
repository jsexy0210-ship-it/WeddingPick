import { AGENCY_CONDITION_LABEL, AGENCY_PRICE_SOURCE_LABEL } from './agency-price';
import { findBannedPhrases, findVaguePhrases } from './copy-rules';
import { DISCLOSURE_LIMIT_LABEL } from './policy-engine';
import { PRICE_JUDGEMENT_LABEL } from './pricing';
import { REPORT_STATE_LABEL } from './report-state';
import { TERMS } from './terms';
import { TOP3_EMPTY, TOP3_PARTIAL_NOTE, TOP3_REASON_LABEL } from './top3';
import { VENDOR_DETAIL_SECTIONS } from './vendor-detail';
import {
  VISIT_NOTE_AUDIO_CONSENT_POINTS,
  VISIT_NOTE_AUDIO_CONSENT_REVOKED_NOTICE,
  VISIT_NOTE_AUDIO_LAWFULNESS_CONFIRM,
} from './visit-note-audio';
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
/*
 * **FAQ는 2026-09-16부터 여기서 빠져 있다.** 질문과 답이 표(`structured.faq_items`)로
 * 내려가면서 이 시험이 볼 글자가 코드에 남지 않았다 — 대표 지시로 운영자가 직접
 * 고치고 지우는 자리가 됐다. 초기값은 옮기기 «전»에 이 시험을 통과한 문장 그대로다.
 *
 * **그래서 지금 FAQ 문구에는 금지어 검사가 걸리지 않는다.** 운영자가 새로 적는 글까지
 * 자동으로 막을지는 대표님 판단이 필요하다(PR 본문 「판단이 필요한 것」).
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
  ['top3:empty', TOP3_EMPTY],
  ['top3:partial', TOP3_PARTIAL_NOTE],
  ['withdrawal:headline', WITHDRAWAL_HEADLINE],
  ['withdrawal:title', WITHDRAWAL_TITLE],
  ['withdrawal:irreversible', WITHDRAWAL_IRREVERSIBLE],
  ['withdrawal:separatedNote', WITHDRAWAL_SEPARATED_NOTE],
  ['withdrawal:sheetBody', WITHDRAWAL_SHEET_BODY],
  ...VISIT_NOTE_AUDIO_CONSENT_POINTS.map((point, index): [string, string] => [
    `visitNoteAudio:consent:${index}`,
    point,
  ]),
  ['visitNoteAudio:lawfulness', VISIT_NOTE_AUDIO_LAWFULNESS_CONFIRM],
  ['visitNoteAudio:revoked', VISIT_NOTE_AUDIO_CONSENT_REVOKED_NOTICE],
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
