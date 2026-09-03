import { INQUIRY_STATUS_LABEL } from './inquiry';
import { REBUTTAL_STATUS_LABEL } from './rebuttal';
import {
  REPORT_STATES,
  REPORT_STATE_LABEL,
  followsStatePolicy,
  reportStateLabel,
} from './report-state';
import { CLAIM_STATUS_LABEL } from './vendor-claim';
import { VERIFICATION_STATUS_LABEL } from './verification';

describe('제보 상태 표시 정책', () => {
  it('각 상태에 사용자 문구가 하나씩 있다', () => {
    for (const state of REPORT_STATES) {
      expect(reportStateLabel(state)).toBeTruthy();
    }
  });

  it('분석 중과 확인 중을 가른다', () => {
    // 앞은 기계가 읽는 중이고 뒤는 사람이 맞춰보는 중이다. 걸리는 시간이 다르다.
    expect(REPORT_STATE_LABEL.analyzing).toBe('분석 중');
    expect(REPORT_STATE_LABEL.verifying).toBe('확인 중');
  });

  it('안에서 다른 두 상태가 밖에서는 같은 말이 된다', () => {
    /*
     * `verifying`과 `under_review`는 안에서는 다른 일이지만, 사용자에게는 둘 다
     * 기다리는 시간이다. 없는 구분을 이름으로 만들지 않는다.
     */
    expect(REPORT_STATE_LABEL.under_review).toBe(REPORT_STATE_LABEL.verifying);
  });

  it('반영되지 않은 것을 한 가지 말로 적는다', () => {
    // `반려`·`확인하지 못함`·`게시하지 않음`이 다 이 말이었다.
    expect(REPORT_STATE_LABEL.rejected).toBe('반영되지 않았어요');
  });
});

describe('흐름마다 같은 말을 쓴다', () => {
  const flows: [string, Record<string, string>][] = [
    ['자료 확인 신청', VERIFICATION_STATUS_LABEL],
    ['업체 관계자 인증', CLAIM_STATUS_LABEL],
    ['업체 반론', REBUTTAL_STATUS_LABEL],
    ['문의', INQUIRY_STATUS_LABEL],
  ];

  it.each(flows)('%s의 상태 문구가 표시 정책 안에 있다', (_name, labels) => {
    /*
     * 흐름이 자기 말을 새로 만들면 같은 일이 화면마다 다른 이름으로 보인다.
     * 표 밖의 말이 필요하면 `REPORT_STATE_EXCEPTIONS`에 이유와 함께 적는다.
     */
    for (const label of Object.values(labels)) {
      expect({ label, ok: followsStatePolicy(label) }).toEqual({ label, ok: true });
    }
  });

  it('끝났다는 말이 흐름마다 같다', () => {
    expect(VERIFICATION_STATUS_LABEL.approved).toBe(REPORT_STATE_LABEL.verified);
    expect(CLAIM_STATUS_LABEL.approved).toBe(REPORT_STATE_LABEL.verified);
    expect(INQUIRY_STATUS_LABEL.answered).toBe(REPORT_STATE_LABEL.verified);
  });

  it('안 됐다는 말도 흐름마다 같다', () => {
    expect(VERIFICATION_STATUS_LABEL.rejected).toBe(REPORT_STATE_LABEL.rejected);
    expect(CLAIM_STATUS_LABEL.rejected).toBe(REPORT_STATE_LABEL.rejected);
    expect(REBUTTAL_STATUS_LABEL.rejected).toBe(REPORT_STATE_LABEL.rejected);
  });

  it('게시됨만 표 밖에 남는다', () => {
    // 확인이 끝난 것과 후기 아래에 실제로 붙어 있는 것은 다른 사실이다.
    expect(REBUTTAL_STATUS_LABEL.published).toBe('게시됨');
    expect(followsStatePolicy('게시됨')).toBe(true);
    expect(followsStatePolicy('승인')).toBe(false);
  });
});
